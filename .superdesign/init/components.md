# Components

No shared UI primitive directory exists yet. Current UI is page-local and uses Tailwind utility classes directly.

Page-local interactive component included because it is the main reusable UI-like component currently present:

## `src/app/attendance/clock.tsx`

Component: `AttendanceClock`

Description: Client-side time clock widget with work and break controls.

Key props:

- `employeeId`
- `todaysLog`

```tsx
"use client";

import { useState, useEffect } from "react";
import { clockIn, clockOut, startBreak, endBreak } from "./actions";

interface ClockProps {
  employeeId: number;
  todaysLog: {
    id: number;
    actual_start: string | null;
    actual_end: string | null;
    actual_break_minutes: number;
    current_break_start: string | null;
  } | null;
}

export function AttendanceClock({ employeeId, todaysLog }: ClockProps) {
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hasClockedIn = todaysLog !== null && todaysLog.actual_start !== null;
  const hasClockedOut = todaysLog !== null && todaysLog.actual_end !== null;
  const isOnBreak = todaysLog !== null && todaysLog.current_break_start !== null;

  return (
    <div className="flex flex-col items-center justify-center space-y-8 py-10">
      <div className="text-6xl font-mono text-gray-800 font-bold tracking-wider tabular-nums">
        {time.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </div>
      {errorMsg && (
        <div className="text-red-600 bg-red-50 p-3 rounded-lg text-sm font-semibold text-center max-w-md w-full">
          {errorMsg}
        </div>
      )}
      <div className="grid grid-cols-2 gap-6 w-full max-w-md">
        <button className="text-xl font-bold py-8 rounded-2xl transition-all shadow-sm flex items-center justify-center bg-blue-600 text-white">
          出勤
        </button>
        <button className="text-xl font-bold py-8 rounded-2xl transition-all shadow-sm flex items-center justify-center bg-gray-800 text-white">
          退勤
        </button>
      </div>
    </div>
  );
}
```

