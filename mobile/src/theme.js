export const T = {
  bg: "#111214",
  cardBg: "#1B1D20",
  ink: "#F5F5F4",
  sub: "#9A9DA3",
  hair: "#2A2C30",
  accent1: "#2ED996", // spring green
  accent2: "#29C4DE", // cyan/teal
  red: "#E2584B", // coral red
  amber: "#DBA94A", // gold
  radius: 22,
  pillActiveBg: "rgba(46, 217, 150, 0.15)",
};

export const card = (extra = {}) => ({
  backgroundColor: T.cardBg,
  borderRadius: T.radius,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 24,
  elevation: 8,
  ...extra,
});
