const MINUTES_PER_OPTION = 15;
const MINUTES_PER_DAY = 24 * 60;

function formatMealTime(totalMinutes: number): string {
  const normalizedMinutes = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  const hours12 = hours24 % 12 || 12;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  return `${hours12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
}

export const MEAL_TIME_OPTIONS = Array.from(
  { length: MINUTES_PER_DAY / MINUTES_PER_OPTION },
  (_, index) => formatMealTime(index * MINUTES_PER_OPTION),
);

export function nearestLocalMealTime(date = new Date()): string {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  const roundedMinutes = Math.round(totalMinutes / MINUTES_PER_OPTION) * MINUTES_PER_OPTION;
  return formatMealTime(roundedMinutes);
}

export function MealTimeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-lg border border-[#cbd8e4] bg-white px-3 font-normal text-[#0b1f33]"
    >
      {MEAL_TIME_OPTIONS.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}
