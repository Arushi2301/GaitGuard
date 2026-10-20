// Greeting for the device's local time: 05:00-11:59 morning, 12:00-16:59 afternoon, otherwise evening
export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}
