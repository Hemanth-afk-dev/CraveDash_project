import type { MenuItem } from "../types/api";

export function getDisplayableMenuItems(
  items: MenuItem[],
  restaurantName: string,
) {
  const normalizedRestaurantName = restaurantName.trim().toLocaleLowerCase();
  return items.filter(
    (item) => {
      const normalizedItemName = item.name.trim().toLocaleLowerCase();
      return (
      Boolean(normalizedItemName) &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      normalizedItemName !== normalizedRestaurantName
      );
    },
  );
}
