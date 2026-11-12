import React from 'react';
import { Calendar } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function DateFilter({ period, setPeriod, startDate, setStartDate, endDate, setEndDate, onFilterChange }) {
  const { t, isRTL } = useLanguage();

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    if (onFilterChange) {
      onFilterChange({ period: newPeriod, startDate, endDate });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => handlePeriodChange('all')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
            period === 'all' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('all')}
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('today')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
            period === 'today' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('today')}
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('week')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
            period === 'week' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('thisWeek')}
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('month')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
            period === 'month' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('thisMonth')}
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('custom')}
          className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
            period === 'custom' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('custom')}
        </button>
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-2 px-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5" />
            <span>{isRTL ? 'من :' : 'Du :'}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (onFilterChange) onFilterChange({ period: 'custom', startDate: e.target.value, endDate });
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold focus:outline-blue-500"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>{isRTL ? 'إلى :' : 'Au :'}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                if (onFilterChange) onFilterChange({ period: 'custom', startDate, endDate: e.target.value });
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold focus:outline-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
