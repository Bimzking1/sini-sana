import { useCallback, useEffect, useState } from "react";
import { parseRoomCodeFromUrl } from "./lib/room/roomId";
import HomeScreen from "./components/HomeScreen";
import RoomScreen from "./components/RoomScreen";
import HowToScreen from "./components/HowToScreen";
import Logo from "./components/Logo";

type Route = { kind: "home" } | { kind: "create" } | { kind: "room"; code: string } | { kind: "howto" };

function routeFromLocation(): Route {
  const code = parseRoomCodeFromUrl(window.location.href);
  if (code) return { kind: "room", code };
  return { kind: "home" };
}

function supportsPeerConnections(): boolean {
  return (
    typeof RTCPeerConnection === "function" &&
    typeof RTCPeerConnection.prototype.createDataChannel === "function"
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromLocation());
  const [unsupported] = useState(() => !supportsPeerConnections());

  useEffect(() => {
    const onHashChange = (): void => {
      setRoute(routeFromLocation());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goHome = useCallback((): void => {
    history.pushState(null, "", window.location.pathname + window.location.search);
    setRoute({ kind: "home" });
  }, []);

  const startCreate = useCallback((): void => {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setRoute({ kind: "create" });
  }, []);

  const startJoin = useCallback((code: string): void => {
    history.replaceState(null, "", `${window.location.pathname}#${code}`);
    setRoute({ kind: "room", code });
  }, []);

  const openHowTo = useCallback((): void => {
    history.pushState(null, "", window.location.pathname + window.location.search);
    setRoute({ kind: "howto" });
  }, []);

  if (unsupported) {
    return <UnsupportedBrowser />;
  }

  if (route.kind === "home") {
    return <HomeScreen onCreate={startCreate} onJoin={startJoin} onOpenHowTo={openHowTo} />;
  }

  if (route.kind === "howto") {
    return <HowToScreen onBack={goHome} />;
  }

  if (route.kind === "create") {
    return <RoomScreen key="create" mode="create" code={null} onLeave={goHome} />;
  }

  return <RoomScreen key={`join:${route.code}`} mode="join" code={route.code} onLeave={goHome} />;
}

function UnsupportedBrowser() {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <div className="animate-pop w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Logo size={44} className="mx-auto" />
        <h1 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
          This browser can't use Sini Sana
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sini Sana needs WebRTC data channels. Try the latest version of Chrome, Edge,
          Firefox, or Safari on mobile or desktop.
        </p>
      </div>
    </div>
  );
}