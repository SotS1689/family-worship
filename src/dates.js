// Days are local calendar dates written "YYYY-MM-DD", so a check-in at 11 pm
// counts for that evening, wherever the phone is.

const pad = (n) => String(n).padStart(2, "0");

export const dayOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const today = () => dayOf(new Date());

// Noon avoids daylight-saving edges when stepping by whole days.
const parse = (day) => {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
};

export const addDays = (day, n) => {
    const d = parse(day);
    d.setDate(d.getDate() + n);
    return dayOf(d);
};

export const daysBetween = (from, to) => Math.round((parse(to) - parse(from)) / 86400000);

export const weekday = (day) => parse(day).getDay(); // 0 = Sunday

// Sunday that starts the week containing `day`
export const weekStart = (day) => addDays(day, -weekday(day));

export const formatDay = (day, opts = { weekday: "short", month: "short", day: "numeric" }) =>
    parse(day).toLocaleDateString(undefined, opts);
