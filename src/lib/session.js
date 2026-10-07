import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";

const IDLE_MS = 20 * 60 * 1000;
const COUNTDOWN_MS = 2 * 60 * 1000;
const HEARTBEAT_MS = 60 * 60 * 1000;

function getDeviceId() {
  let id = localStorage.getItem("umbral-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("umbral-device-id", id);
  }
  return id;
}

function deviceLabel() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Dispositivo";
}

export function useSessionHeartbeat() {
  const lastBeat = useRef(0);
  useEffect(() => {
    const beat = async () => {
      const now = Date.now();
      if (now - lastBeat.current < HEARTBEAT_MS) return;
      lastBeat.current = now;
      try {
        await base44.functions.invoke("sessionHeartbeat", {
          device_id: getDeviceId(),
          device_label: deviceLabel(),
        });
      } catch (e) {
        // non-fatal
      }
    };
    beat();
    const interval = setInterval(beat, 60 * 1000);
    return () => clearInterval(interval);
  }, []);
}

export function useSessionTimeout() {
  const { logout } = useAuth();
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(COUNTDOWN_MS);
  const timer = useRef(null);
  const lastActivity = useRef(Date.now());
  const countdownRef = useRef(null);

  const reset = useCallback(() => {
    lastActivity.current = Date.now();
    setWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  useEffect(() => {
    const onActivity = () => {
      lastActivity.current = Date.now();
      if (warning) reset();
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    timer.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_MS && !warning) {
        setWarning(true);
        setRemaining(COUNTDOWN_MS);
        countdownRef.current = setInterval(() => {
          setRemaining((r) => {
            if (r <= 1000) {
              clearInterval(countdownRef.current);
              logout(true);
              return 0;
            }
            return r - 1000;
          });
        }, 1000);
      }
    }, 5000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      if (timer.current) clearInterval(timer.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [warning, reset, logout]);

  return { warning, remaining, dismiss: reset };
}