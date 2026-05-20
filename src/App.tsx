import { Eye, EyeOff, Lock, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { OperationsApp } from "./OperationsApp";
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

function publicAsset(path: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, "")}`;
}

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

function useAppFullscreen() {
  useEffect(() => {
    let requestInFlight = false;

    const requestFullscreenFromGesture = () => {
      if (requestInFlight) return;
      requestInFlight = true;
      requestDocumentFullscreen().finally(() => {
        requestInFlight = false;
      });
    };

    const interactionEvents = ["pointerdown", "touchstart", "click", "keydown"];
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestFullscreenFromGesture, { capture: true });
    });

    return () => {
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestFullscreenFromGesture, { capture: true });
      });
    };
  }, []);
}

function App() {
  useAppFullscreen();
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
        <div className="auth-gate" data-testid="auth-gate">
          <AuthLaunchLogo animating={!launchComplete} />
          <LoginLandingPage visible={true} handoffActive={!launchComplete} />
          {!launchComplete && <LaunchLogoAnimation onReveal={revealLogin} onComplete={completeLaunch} />}
        </div>
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <div className={`authenticated-app-shell${loginJustCompleted || loginTransitionActive ? " is-login-transitioning" : ""}`} data-testid="authenticated-app-shell">
        <OperationsApp />
      </div>
      <ToastViewport />
    </>
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

function LoginLandingPage({ visible, handoffActive = false }: { visible: boolean; handoffActive?: boolean }) {
  const { login, register, showToast } = useAppState();
  const navigate = useNavigate();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [registerErrors, setRegisterErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [portraitVisible, setPortraitVisible] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const loginLandingStyle = { "--login-bg-image": `url("${publicAsset("NewFinalBackground.png")}")` } as CSSProperties;

  const submitLogin = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(loginForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Enter a username and password.");
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
    login(loginForm.username, true, "staff");
    navigate("/");
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

  const guest = () => {
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
          <button className="login-create" type="button" onClick={() => setRegisterOpen(true)}>
            Create New Account
          </button>
          <button className="login-guest" type="button" onClick={guest}>
            Sign in as Guest
          </button>
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
