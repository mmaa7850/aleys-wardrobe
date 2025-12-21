// src/utils/date.js
export const formatDateTime = (val) => {
  if (!val) return "";

  const d = new Date(val);

  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}/` +
    `${pad(d.getMonth() + 1)}/` +
    `${pad(d.getDate())} ` +
    `${pad(d.getHours())}:` +
    `${pad(d.getMinutes())}:` +
    `${pad(d.getSeconds())}`
  );
};
