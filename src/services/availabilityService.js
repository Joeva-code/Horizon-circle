const dateKey = (value) => new Date(value).toISOString().slice(0, 10);

export const normalizeAvailability = (value) => {
  const availability = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const unavailableDates = Array.isArray(availability.unavailableDates)
    ? [...new Set(availability.unavailableDates.map(dateKey))].sort()
    : [];

  return { unavailableDates };
};

export const isAvailableOn = (availability, eventDate) => {
  return !normalizeAvailability(availability).unavailableDates.includes(dateKey(eventDate));
};
