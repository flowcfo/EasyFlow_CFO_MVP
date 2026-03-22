export default function SliderInput({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '', formatValue }) {
  const display = formatValue ? formatValue(value) : `${value}${suffix}`;
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-mulish text-sm text-stone-light">{label}</span>
        <span className="font-sora text-sm text-white">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #F05001 0%, #F05001 ${progress}%, #162844 ${progress}%, #162844 100%)`,
        }}
      />
    </div>
  );
}
