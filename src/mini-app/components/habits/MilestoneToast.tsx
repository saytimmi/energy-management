import { useEffect, useState } from "preact/hooks";

interface MilestoneToastProps {
  message: string;
  onDismiss: () => void;
}

export function MilestoneToast({ message, onDismiss }: MilestoneToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-up on next frame
    const showTimer = setTimeout(() => setVisible(true), 16);

    // Auto-dismiss after 4 seconds
    const dismissTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400); // wait for slide-down transition
    }, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, []);

  return (
    <div class={`milestone-toast ${visible ? "visible" : ""}`} onClick={() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }}>
      {message}
    </div>
  );
}
