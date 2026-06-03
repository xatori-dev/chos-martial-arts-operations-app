import { AlertTriangle, ArrowRight, Award, BookOpenCheck, ChevronLeft, Dumbbell, Eye, EyeOff, HeartHandshake, Lock, ShieldCheck, User, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { publicAsset } from "./appAssets";
import { useAppState } from "./state";
import { initializeAppTheme } from "./theme";
import {
  createGuestSession,
  getInitialLaunchPhase,
  getLoginGateState,
  isPrototypeManagerLogin,
  isPrototypeParentLogin,
  isPrototypeStudentLogin,
  prototypeManagerLogin,
  prototypeParentLogin,
  prototypeStudentLogin,
  validateLoginForm,
  validateRegisterForm
} from "./utils";

const LazyOperationsApp = lazy(() => import("./OperationsApp").then(({ OperationsApp }) => ({ default: OperationsApp })));
const TestOperationsApp = import.meta.env.MODE === "test" ? (await import("./OperationsApp")).OperationsApp : undefined;

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
};

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type PortraitLockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait") => Promise<void> | void;
};

function getActiveFullscreenElement(doc: FullscreenCapableDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}

function canRequestFullscreen(doc: FullscreenCapableDocument, element: FullscreenCapableElement) {
  const fullscreenEnabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? doc.msFullscreenEnabled ?? true;
  return fullscreenEnabled !== false && Boolean(element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen);
}

function requestDocumentFullscreen() {
  const doc = document as FullscreenCapableDocument;
  const element = document.documentElement as FullscreenCapableElement;
  if (getActiveFullscreenElement(doc) || !canRequestFullscreen(doc, element)) return Promise.resolve();

  const requestFullscreen = element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen;
  return Promise.resolve(requestFullscreen.call(element)).catch(() => undefined);
}

function requestPortraitOrientationLock() {
  const orientation = window.screen.orientation as PortraitLockableScreenOrientation | undefined;
  const lockOrientation = orientation?.lock;
  if (!lockOrientation) return Promise.resolve();

  return Promise.resolve(lockOrientation.call(orientation, "portrait")).catch(() => undefined);
}

function useAppPortraitRuntime() {
  useEffect(() => {
    let requestInFlight = false;

    const requestPortraitRuntimeFromGesture = () => {
      if (requestInFlight) return;
      requestInFlight = true;
      requestDocumentFullscreen()
        .then(() => requestPortraitOrientationLock())
        .finally(() => {
          requestInFlight = false;
        });
    };

    const interactionEvents = ["pointerdown", "touchstart", "click", "keydown"];
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestPortraitRuntimeFromGesture, { capture: true });
    });

    return () => {
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestPortraitRuntimeFromGesture, { capture: true });
      });
    };
  }, []);
}

function App() {
  useAppPortraitRuntime();
  useEffect(() => {
    initializeAppTheme();
  }, []);
  const { session } = useAppState();
  const [launchComplete, setLaunchComplete] = useState(false);
  const loginGateState = getLoginGateState(session);
  const previousLoginGateStateRef = useRef(loginGateState);
  const loginJustCompleted = previousLoginGateStateRef.current === "login" && loginGateState !== "login";
  const [loginTransitionActive, setLoginTransitionActive] = useState(false);
  const revealLogin = useCallback(() => undefined, []);
  const completeLaunch = useCallback(() => {
    setLaunchComplete(true);
  }, []);

  useEffect(() => {
    previousLoginGateStateRef.current = loginGateState;
    if (!loginJustCompleted) return;

    setLoginTransitionActive(true);
    const timer = window.setTimeout(() => setLoginTransitionActive(false), 760);
    return () => window.clearTimeout(timer);
  }, [loginGateState, loginJustCompleted]);

  if (loginGateState === "login") {
    return (
      <>
        <PortraitAppShell>
          <div className="auth-gate" data-testid="auth-gate">
            <AuthLaunchLogo animating={!launchComplete} />
            <LoginLandingPage visible={true} handoffActive={!launchComplete} />
            {!launchComplete && <LaunchLogoAnimation onReveal={revealLogin} onComplete={completeLaunch} />}
          </div>
        </PortraitAppShell>
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <PortraitAppShell>
        <div className={`authenticated-app-shell${loginJustCompleted || loginTransitionActive ? " is-login-transitioning" : ""}`} data-testid="authenticated-app-shell">
          {TestOperationsApp ? (
            <TestOperationsApp />
          ) : (
            <Suspense fallback={<div className="authenticated-app-loading" role="status" aria-live="polite">Loading Cho&apos;s workspace...</div>}>
              <LazyOperationsApp />
            </Suspense>
          )}
        </div>
      </PortraitAppShell>
      <ToastViewport />
    </>
  );
}

function PortraitAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="portrait-app-shell" data-testid="portrait-app-shell" data-orientation-lock="portrait" aria-label="Cho's Martial Arts portrait app frame">
      <div className="portrait-app-frame">
        {children}
      </div>
    </div>
  );
}

function ToastViewport() {
  const { toasts, dismissToast } = useAppState();
  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                dismissToast(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function AuthLaunchLogo({ animating }: { animating: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <img
      className={`auth-logo ${animating && !prefersReducedMotion ? "is-animating" : "is-settled"}`}
      src={publicAsset("682e95109aa21_chos-logo.png")}
      alt="Cho's Martial Arts"
    />
  );
}

function LaunchLogoAnimation({ onReveal, onComplete }: { onReveal: () => void; onComplete: () => void }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase] = useState(() => getInitialLaunchPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const [frameIndex, setFrameIndex] = useState(0);
  const frameCount = 60;
  const loaderDuration = phase === "final-logo" || prefersReducedMotion ? 950 : 3050;
  const revealDelay = phase === "final-logo" || prefersReducedMotion ? 80 : 1560;
  const fighterDuration = 1850;
  const frameSrc = `${publicAsset(`roundhouse-frames/frame-${String(frameIndex).padStart(2, "0")}.png`)}?v=clean-no-lines-2`;

  useEffect(() => {
    const imageSources = [
      ...Array.from({ length: frameCount }, (_, index) => `${publicAsset(`roundhouse-frames/frame-${String(index).padStart(2, "0")}.png`)}?v=clean-no-lines-2`),
      publicAsset("682e95109aa21_chos-logo.png")
    ];
    imageSources.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || phase === "final-logo") {
      const revealTimer = window.setTimeout(onReveal, revealDelay);
      const timer = window.setTimeout(onComplete, loaderDuration);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(timer);
      };
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    const render = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);
      const fighterElapsed = Math.min(elapsed, fighterDuration);
      setFrameIndex(Math.min(frameCount - 1, Math.floor((fighterElapsed / fighterDuration) * (frameCount - 1))));
      if (elapsed < loaderDuration) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    animationFrame = window.requestAnimationFrame(render);
    const revealTimer = window.setTimeout(onReveal, revealDelay);
    const timer = window.setTimeout(onComplete, loaderDuration);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(revealTimer);
      window.clearTimeout(timer);
    };
  }, [fighterDuration, loaderDuration, onComplete, onReveal, phase, prefersReducedMotion, revealDelay]);

  return (
    <section className={`launch-loader ${prefersReducedMotion || phase === "final-logo" ? "is-reduced" : "is-playing"}`} aria-label="Cho's Martial Arts loading animation">
      <div className="launch-screen-backdrop"></div>
      <div className="launch-stage" aria-hidden="true">
        <div className="launch-stage-haze"></div>
        <div className="launch-floor-glow"></div>
        {!prefersReducedMotion && phase !== "final-logo" && <img className="launch-fighter-frame" src={frameSrc} alt="" />}
        <div className="launch-impact-flash"></div>
        <div className="launch-logo-aura"></div>
        <div className="launch-letter-sparks"></div>
      </div>
    </section>
  );
}

const guestTeachingHighlights = [
  {
    cue: "01",
    icon: <BookOpenCheck size={20} />,
    title: "Focus",
    text: "Listen. Practice. Improve."
  },
  {
    cue: "02",
    icon: <HeartHandshake size={20} />,
    title: "Respect",
    text: "Courtesy. Control. Confidence."
  },
  {
    cue: "03",
    icon: <Dumbbell size={20} />,
    title: "Strength",
    text: "Balance. Fitness. Awareness."
  }
];

const guestProgramAudiences = ["Kids", "Teens", "Adults", "Families"];

const guestIntroStages = [
  {
    id: "arrive",
    label: "Arrive",
    title: "Step onto the mat",
    text: "Settle in with a clear view of the studio and class energy."
  },
  {
    id: "practice",
    label: "Practice",
    title: "Follow the rhythm",
    text: "See focus, respect, and technique build through guided repetition."
  },
  {
    id: "belong",
    label: "Belong",
    title: "Preview the path",
    text: "Continue into the app with the full guest workspace ready."
  }
];

function LoginLandingPage({ visible, handoffActive = false }: { visible: boolean; handoffActive?: boolean }) {
  const { childUsernameExists, login, loginChildCredentials, loginManagedAccount, managedUsernameExists, register, showToast } = useAppState();
  const navigate = useNavigate();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [portraitVisible, setPortraitVisible] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [guestIntroOpen, setGuestIntroOpen] = useState(false);
  const [loginFailedOpen, setLoginFailedOpen] = useState(false);
  const loginLandingStyle = { "--login-bg-image": `url("${publicAsset("NewFinalBackground.png")}")` } as CSSProperties;
  const guestIntroImage = publicAsset("assets/guest-intro/cho-guest-class-intro-v2.png");
  const guestIntroStyle = { "--guest-intro-image": `url("${guestIntroImage}")` } as CSSProperties;

  const failLogin = (message: string) => {
    showToast(message);
    setLoginFailedOpen(true);
  };

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(loginForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      failLogin("Enter a username and password.");
      return;
    }
    if (isPrototypeManagerLogin(loginForm)) {
      login(prototypeManagerLogin.email, true, prototypeManagerLogin.role);
      navigate("/");
      return;
    }
    if (isPrototypeStudentLogin(loginForm)) {
      login(prototypeStudentLogin.email, true, prototypeStudentLogin.role);
      navigate("/");
      return;
    }
    if (isPrototypeParentLogin(loginForm)) {
      login(prototypeParentLogin.email, true, prototypeParentLogin.role);
      navigate("/");
      return;
    }
    const childAccount = loginChildCredentials(loginForm);
    if (childAccount) {
      navigate("/");
      return;
    }
    const managedAccount = loginManagedAccount(loginForm);
    if (managedAccount) {
      navigate("/");
      return;
    }
    if (managedUsernameExists(loginForm.username)) {
      failLogin("Check the username and password.");
      return;
    }
    if (childUsernameExists(loginForm.username)) {
      failLogin("Check the child username and password.");
      return;
    }
    failLogin("Check the username and password.");
  };

  const submitRegister = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateRegisterForm(registerForm);
    setRegisterErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Check the create account fields.");
      return;
    }
    register(registerForm.email);
    login(registerForm.email, true, "staff");
    navigate("/");
  };

  const continueAsGuest = () => {
    const guestSession = createGuestSession();
    login(guestSession.email, guestSession.remembered, "staff");
    navigate("/");
  };

  return (
    <section className={`login-landing ${visible ? "is-visible" : ""} ${handoffActive ? "is-handoff" : ""}`} style={loginLandingStyle} aria-label="Cho's Martial Arts login">
      <div className="login-scrim"></div>
      <button
        className="login-portrait-toggle is-above-launch"
        type="button"
        aria-pressed={portraitVisible}
        aria-label={portraitVisible ? "Hide portrait background" : "Show portrait background"}
        title={portraitVisible ? "Hide portrait background" : "Show portrait background"}
        onClick={() => setPortraitVisible((visible) => !visible)}
      >
        {portraitVisible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {portraitVisible && (
        <div className="login-portrait-stage" aria-hidden="true">
          <img src={publicAsset("Perfect1.png")} alt="" draggable={false} />
        </div>
      )}
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={submitLogin}>
          <label className="login-field">
            <User size={34} aria-hidden="true" />
            <span className="sr-only">Username</span>
            <input
              autoComplete="username"
              placeholder="Username"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
            />
          </label>
          {errors.username && <p className="login-error">{errors.username}</p>}
          <label className="login-field">
            <Lock size={32} aria-hidden="true" />
            <span className="sr-only">Password</span>
            <input
              autoComplete="current-password"
              placeholder="Password"
              type={passwordVisible ? "text" : "password"}
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            />
            <button className="login-field-action" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={32} /> : <Eye size={32} />}
            </button>
          </label>
          {errors.password && <p className="login-error">{errors.password}</p>}
          <button className="login-submit" type="submit">
            Sign In
          </button>
          <div className="login-secondary-actions">
            <button className="login-create" type="button" onClick={() => setRegisterOpen(true)}>
              Create New Account
            </button>
            <button className="login-guest" type="button" onClick={() => setGuestIntroOpen(true)}>
              Sign in as Guest
            </button>
          </div>
        </form>
        <div className="login-divider" aria-hidden="true">
          <span></span>
          <span className="yin-yang">☯</span>
          <span></span>
        </div>
      </div>
      {registerOpen && (
        <ModalShell label="Create New Account" onClose={() => setRegisterOpen(false)} panelClass="modal-card login-register-modal">
          <div className="drawer-head">
            <h2>Create New Account</h2>
            <button className="icon-button" aria-label="Close create account" onClick={() => setRegisterOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <form className="modal-form" onSubmit={submitRegister}>
            <Field label="Email address" error={registerErrors.email}>
              <input className="input" autoComplete="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} />
            </Field>
            <Field label="Password" error={registerErrors.password}>
              <input className="input" type="password" autoComplete="new-password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} />
            </Field>
            <p className="muted">This creates a local prototype account only.</p>
            <button className="btn btn-red" type="submit">
              Create Account
            </button>
          </form>
        </ModalShell>
      )}
      {loginFailedOpen && (
        <ModalShell label="Login failed" onClose={() => setLoginFailedOpen(false)} panelClass="modal-card login-failed-modal">
          <div className="login-failed-content">
            <span className="login-failed-icon" aria-hidden="true">
              <AlertTriangle size={24} strokeWidth={2.4} />
            </span>
            <h2>Login failed</h2>
            <p>Please check your username and password and try again.</p>
            <button className="btn btn-red login-failed-action" type="button" onClick={() => setLoginFailedOpen(false)}>
              Try Again
            </button>
          </div>
        </ModalShell>
      )}
      {guestIntroOpen && (
        <section
          className="guest-intro-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Cho's Martial Arts guest introduction"
          aria-describedby="guest-intro-description"
          data-motion={prefersReducedMotion ? "reduced" : "sequence"}
        >
          <div className="guest-intro-panel" data-testid="guest-intro-panel" style={guestIntroStyle}>
            <div className="guest-intro-frame" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div className="guest-intro-media" aria-hidden="true">
              <div className="guest-intro-sequence" data-testid="guest-intro-sequence">
                {guestIntroStages.map((stage) => (
                  <figure
                    className={`guest-intro-scene guest-intro-scene--${stage.id}`}
                    data-testid={`guest-intro-scene-${stage.id}`}
                    key={stage.id}
                  >
                    <span className="guest-intro-scene-image"></span>
                    <figcaption>
                      <span>{stage.label}</span>
                      <strong>{stage.title}</strong>
                      <small>{stage.text}</small>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <div className="guest-intro-timeline" data-testid="guest-intro-timeline">
                {guestIntroStages.map((stage) => (
                  <span key={stage.id}>{stage.label}</span>
                ))}
              </div>
            </div>
            <div className="guest-intro-content">
              <div className="guest-intro-copy">
                <div className="guest-intro-brand">
                  <span className="guest-intro-mark" aria-hidden="true">
                    <ShieldCheck size={20} />
                  </span>
                  <span>Cho's Martial Arts</span>
                </div>
                <p className="guest-intro-eyebrow">Guest preview</p>
                <h2 id="guest-intro-title">Confidence. Respect. Focus.</h2>
                <p id="guest-intro-description">A guided first look at the mat, the rhythm, and the class community.</p>
                <p className="guest-intro-subcopy">Discipline. Fitness. Self-defense. Character.</p>
              </div>
              <div className="guest-intro-highlights" aria-label="What Cho's Martial Arts teaches">
                {guestTeachingHighlights.map((highlight) => (
                  <article key={highlight.title}>
                    <span className="guest-intro-highlight-icon" aria-hidden="true">{highlight.icon}</span>
                    <div>
                      <span className="guest-intro-highlight-cue">{highlight.cue}</span>
                      <h3>{highlight.title}</h3>
                      <p>{highlight.text}</p>
                    </div>
                  </article>
                ))}
              </div>
              <div className="guest-intro-programs" aria-label="Guest introduction class overview">
                {guestProgramAudiences.map((audience) => (
                  <span key={audience}>
                    <Award size={15} aria-hidden="true" />
                    {audience}
                  </span>
                ))}
              </div>
              <div className="guest-intro-actions">
                <div className="guest-intro-action-note" aria-hidden="true">
                  <span></span>
                  Ready when you are
                </div>
                <div className="guest-intro-action-buttons">
                  <button className="guest-intro-back" type="button" onClick={() => setGuestIntroOpen(false)}>
                    <ChevronLeft size={18} /> Back
                  </button>
                  <button className="guest-intro-continue" type="button" onClick={continueAsGuest}>
                    Enter as Guest <ArrowRight size={19} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="field-label">
      {label}
      {children}
      {error && <span className="form-error">{error}</span>}
    </label>
  );
}

function ModalShell({ label, onClose, panelClass, children }: { label: string; onClose: () => void; panelClass: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={panelClass} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef}>
        {children}
      </div>
    </div>
  );
}

export default App;
