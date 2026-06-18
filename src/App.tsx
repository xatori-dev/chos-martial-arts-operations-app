import { AlertTriangle, Eye, EyeOff, Lock, User, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { publicAsset } from "./appAssets";
import { useAppState } from "./state";
import { isSupabaseAuthConfigured, isSupportedSupabaseLoginUsername, signInSupabaseAccount } from "./supabaseAccounts";
import { initializeAppTheme } from "./theme";
import {
  getInitialLaunchPhase,
  getLoginGateState,
  isPrototypeDeveloperLogin,
  isPrototypeManagerLogin,
  prototypeDeveloperLogin,
  prototypeManagerLogin,
  validateLoginForm
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

type PortraitLockOrientation = "portrait-primary" | "portrait";

type PortraitLockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitLockOrientation) => Promise<void> | void;
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

  return Promise.resolve(lockOrientation.call(orientation, "portrait-primary"))
    .catch(() => Promise.resolve(lockOrientation.call(orientation, "portrait")).catch(() => undefined));
}

function useAppPortraitRuntime() {
  useEffect(() => {
    let requestInFlight = false;

    const requestPortraitRuntime = () => {
      if (requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;
      requestDocumentFullscreen()
        .then(() => requestPortraitOrientationLock())
        .finally(() => {
          requestInFlight = false;
        });
    };

    const interactionEvents = ["pointerdown", "touchstart", "click", "keydown"];
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestPortraitRuntime, { capture: true });
    });

    const documentRuntimeEvents = ["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange", "visibilitychange"];
    documentRuntimeEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestPortraitRuntime);
    });

    const windowRuntimeEvents = ["orientationchange", "resize"];
    windowRuntimeEvents.forEach((eventName) => {
      window.addEventListener(eventName, requestPortraitRuntime);
    });
    window.visualViewport?.addEventListener("resize", requestPortraitRuntime);

    return () => {
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestPortraitRuntime, { capture: true });
      });
      documentRuntimeEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestPortraitRuntime);
      });
      windowRuntimeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, requestPortraitRuntime);
      });
      window.visualViewport?.removeEventListener("resize", requestPortraitRuntime);
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
    <div className="portrait-app-shell" data-testid="portrait-app-shell" data-orientation-lock="portrait-primary" aria-label="Cho's Martial Arts portrait app frame">
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

function LoginLandingPage({ visible, handoffActive = false }: { visible: boolean; handoffActive?: boolean }) {
  const { login, loginCreatedAccount, showToast } = useAppState();
  const navigate = useNavigate();
  const loginLandingRef = useRef<HTMLElement | null>(null);
  const portraitStageRef = useRef<HTMLDivElement | null>(null);
  const usernameFieldRef = useRef<HTMLLabelElement | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [portraitVisible, setPortraitVisible] = useState(true);
  const [loginFailedOpen, setLoginFailedOpen] = useState(false);
  const [loginPending, setLoginPending] = useState(false);
  const supabaseConfigured = isSupabaseAuthConfigured();
  const loginLandingStyle = { "--login-bg-image": `url("${publicAsset("NewFinalBackground.png")}")` } as CSSProperties;

  useEffect(() => {
    const landing = loginLandingRef.current;
    const portraitStage = portraitStageRef.current;
    const usernameField = usernameFieldRef.current;
    if (!portraitVisible || !landing || !portraitStage || !usernameField) return undefined;

    let animationFrame = 0;
    const setPortraitAnchor = () => {
      const usernameRect = usernameField.getBoundingClientRect();
      const portraitRect = portraitStage.getBoundingClientRect();
      const portraitStyles = window.getComputedStyle(portraitStage);
      const portraitHeight = parseFloat(portraitStyles.height) || portraitRect.height;
      const portraitWidth = parseFloat(portraitStyles.width) || portraitRect.width;
      if (usernameRect.height <= 0 || portraitHeight <= 0 || portraitWidth <= 0) return;

      const portraitImage = portraitStage.querySelector("img");
      const portraitImageRatio = portraitImage?.naturalWidth && portraitImage.naturalHeight
        ? portraitImage.naturalHeight / portraitImage.naturalWidth
        : 1;
      const visiblePortraitHeight = Math.min(portraitHeight, portraitWidth * portraitImageRatio);
      const usernameUnderlap = Math.min(6, Math.max(4, usernameRect.height * 0.1));
      const fieldAnchoredCenterY = usernameRect.top + usernameUnderlap - portraitHeight / 2;
      const logo = landing.closest(".auth-gate")?.querySelector(".auth-logo") as HTMLElement | null;
      const logoRect = logo?.getBoundingClientRect();
      const logoSafeGap = 12;
      const logoSafeCenterY = logoRect && logoRect.height > 0
        ? logoRect.bottom + logoSafeGap + visiblePortraitHeight - portraitHeight / 2
        : 0;
      const anchoredCenterY = Math.max(fieldAnchoredCenterY, logoSafeCenterY);
      landing.style.setProperty("--login-portrait-anchor-y", `${Math.round(anchoredCenterY * 100) / 100}px`);
    };
    const updatePortraitAnchor = () => {
      window.cancelAnimationFrame(animationFrame);
      setPortraitAnchor();
      animationFrame = window.requestAnimationFrame(setPortraitAnchor);
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePortraitAnchor);
    resizeObserver?.observe(landing);
    resizeObserver?.observe(portraitStage);
    resizeObserver?.observe(usernameField);
    window.addEventListener("resize", updatePortraitAnchor);
    window.addEventListener("orientationchange", updatePortraitAnchor);
    window.visualViewport?.addEventListener("resize", updatePortraitAnchor);
    void document.fonts?.ready.then(updatePortraitAnchor).catch(() => undefined);
    updatePortraitAnchor();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePortraitAnchor);
      window.removeEventListener("orientationchange", updatePortraitAnchor);
      window.visualViewport?.removeEventListener("resize", updatePortraitAnchor);
      landing.style.removeProperty("--login-portrait-anchor-y");
    };
  }, [handoffActive, portraitVisible, visible]);

  const failLogin = (message: string) => {
    showToast(message);
    setLoginFailedOpen(true);
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(loginForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      failLogin("Enter a username and password.");
      return;
    }

    if (isPrototypeDeveloperLogin(loginForm)) {
      login(prototypeDeveloperLogin.email, true, prototypeDeveloperLogin.role);
      navigate("/");
      return;
    }

    if (supabaseConfigured && isPrototypeManagerLogin(loginForm)) {
      failLogin("Use the live Supabase password for Manager123.");
      return;
    }

    if (supabaseConfigured && isSupportedSupabaseLoginUsername(loginForm.username)) {
      setLoginPending(true);
      try {
        const supabaseLogin = await signInSupabaseAccount(loginForm);
        if (supabaseLogin.status === "authenticated") {
          login(supabaseLogin.sessionEmail, true, supabaseLogin.role);
          navigate("/");
          return;
        }
        failLogin(supabaseLogin.status === "inactive" ? "The account is inactive." : "Check the Supabase username and password.");
        return;
      } finally {
        setLoginPending(false);
      }
    }

    if (!supabaseConfigured) {
      const createdAccount = loginCreatedAccount(loginForm);
      if (createdAccount) {
        navigate("/");
        return;
      }
    }

    if (isPrototypeManagerLogin(loginForm)) {
      login(prototypeManagerLogin.email, true, prototypeManagerLogin.role);
      navigate("/");
      return;
    }
    failLogin("Check the username and password.");
  };

  return (
    <section ref={loginLandingRef} className={`login-landing ${visible ? "is-visible" : ""} ${handoffActive ? "is-handoff" : ""}`} style={loginLandingStyle} aria-label="Cho's Martial Arts login">
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
        <div ref={portraitStageRef} className="login-portrait-stage" aria-hidden="true">
          <img src={publicAsset("Perfect1.png")} alt="" draggable={false} />
        </div>
      )}
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={submitLogin}>
          <label ref={usernameFieldRef} className="login-field">
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
          <button className="login-submit" type="submit" disabled={loginPending}>
            {loginPending ? "Signing In..." : "Sign In"}
          </button>
        </form>
        <div className="login-divider" aria-hidden="true">
          <span></span>
          <span className="yin-yang">☯</span>
          <span></span>
        </div>
      </div>
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
    </section>
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
