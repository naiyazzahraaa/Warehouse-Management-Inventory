import React from 'react';
import { Calendar, Clock, RotateCcw } from 'lucide-react';
import { padZero, formatDateTime24h } from '../utils/dateFormat';

interface DateTime24PickerProps {
  value: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

export const DateTime24Picker: React.FC<DateTime24PickerProps> = ({
  value,
  onChange,
  label = 'Waktu Transaksi (Format 24 Jam)',
  required = true,
}) => {
  // Parse date and time from current value
  const parsedDate = React.useMemo(() => {
    const d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) {
      const now = new Date();
      return {
        dateStr: `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}`,
        hours: padZero(now.getHours()),
        minutes: padZero(now.getMinutes()),
      };
    }
    return {
      dateStr: `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`,
      hours: padZero(d.getHours()),
      minutes: padZero(d.getMinutes()),
    };
  }, [value]);

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    const combined = `${newDate}T${parsedDate.hours}:${parsedDate.minutes}`;
    onChange(combined);
  };

  const handleHourChange = (newHour: string) => {
    const combined = `${parsedDate.dateStr}T${padZero(Number(newHour))}:${parsedDate.minutes}`;
    onChange(combined);
  };

  const handleMinuteChange = (newMinute: string) => {
    const combined = `${parsedDate.dateStr}T${parsedDate.hours}:${padZero(Number(newMinute))}`;
    onChange(combined);
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    onChange(localIso);
  };

  // Generate 24 hours (00 to 23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => padZero(i));
  // Generate 60 minutes (00 to 59)
  const minuteOptions = Array.from({ length: 60 }, (_, i) => padZero(i));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-700" />
          <span>{label}</span>
          {required && <span className="text-red-600 font-bold">*</span>}
        </label>
        <span className="text-[11px] font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {value ? formatDateTime24h(value) : '-'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Date input */}
        <div className="sm:col-span-6 relative">
          <input
            type="date"
            value={parsedDate.dateStr}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white text-slate-900 font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-800"
            required={required}
          />
        </div>

        {/* 24-Hour Time Selectors */}
        <div className="sm:col-span-6 flex items-center gap-1.5">
          <div className="flex items-center flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1 focus-within:ring-2 focus-within:ring-blue-800">
            <Clock className="w-3.5 h-3.5 text-slate-600 mr-1.5 shrink-0" />
            <select
              value={parsedDate.hours}
              onChange={(e) => handleHourChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-hidden cursor-pointer"
              title="Jam (00-23)"
            >
              {hourOptions.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="font-bold text-slate-600 px-1">:</span>
            <select
              value={parsedDate.minutes}
              onChange={(e) => handleMinuteChange(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-slate-900 focus:outline-hidden cursor-pointer"
              title="Menit (00-59)"
            >
              {minuteOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <span className="ml-auto text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              24h
            </span>
          </div>

          <button
            type="button"
            onClick={handleSetCurrentTime}
            className="px-2.5 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            title="Set ke waktu sekarang"
          >
            <RotateCcw className="w-3 h-3 text-slate-700" />
            <span className="hidden sm:inline">Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
