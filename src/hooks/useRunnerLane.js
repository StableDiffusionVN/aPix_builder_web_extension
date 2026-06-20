import { useCallback, useRef, useState } from "react";

export function laneKeyForKind(kind) {
  return kind === "comfy" ? "comfy" : "rh";
}

export function laneKeyForMode(mode) {
  return mode === "comfy" ? "comfy" : "rh";
}

export function useRunnerLane() {
  const [running, setRunning] = useState(false);
  const [activeJob, setActiveJob] = useState(null);
  const [queue, setQueueState] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const queueRef = useRef([]);
  const activeJobRef = useRef(null);
  const abortRef = useRef(null);

  const setQueue = useCallback(nextQueue => {
    queueRef.current = nextQueue;
    setQueueState(nextQueue);
  }, []);

  return {
    running,
    setRunning,
    activeJob,
    setActiveJob,
    queue,
    queueRef,
    activeJobRef,
    abortRef,
    setQueue,
    status,
    setStatus,
    error,
    setError
  };
}
