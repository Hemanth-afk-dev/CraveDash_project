import { describe, expect, it } from "vitest";
import { getDisplayableMenuItems } from "./menu";
import type { MenuItem } from "../types/api";

const menu: MenuItem[] = [
  {
    id: 1,
    restaurantId: 1,
    name: "Paneer Tikka",
    description: "Charred paneer with spices.",
    price: 250,
    available: true,
  },
  {
    id: 2,
    restaurantId: 1,
    name: "Spice Hub",
    description: "Invalid duplicate restaurant label.",
    price: 0,
    available: true,
  },
  {
    id: 3,
    restaurantId: 1,
    name: "Zero price item",
    description: null,
    price: 0,
    available: true,
  },
];

describe("displayable restaurant menu", () => {
  it("hides zero-priced rows and a duplicate restaurant-name menu entry", () => {
    expect(getDisplayableMenuItems(menu, " spice hub ")).toEqual([menu[0]]);
  });
});
