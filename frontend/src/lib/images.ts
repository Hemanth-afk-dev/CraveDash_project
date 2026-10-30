import type { MenuItem, Restaurant } from "../types/api";

const restaurantPhotos = [
  "photo-1555939594-58d7cb561ad1",
  "photo-1517248135467-4c7edcad34c4",
  "photo-1515003197210-e0cd7184f8b5",
  "photo-1512621776951-a57141f2eefd",
];

const foodPhotos = {
  biryani: "photo-1633945274405-b6c8069047b0",
  curry: "photo-1565557623262-b51c2513a641",
  dosa: "photo-1630383249896-424e482df921",
  salad: "photo-1546069901-ba9599a7e63c",
  pizza: "photo-1513104890138-7c749659a591",
  burger: "photo-1568901346375-23c9450c58cd",
  dessert: "photo-1488477181946-6428a0291777",
  grilled: "photo-1544025162-d76694265947",
  noodles: "photo-1569718212165-3a8278d5f624",
  default: "photo-1547592180-85f173990554",
};

function unsplashImage(imageId: string, width: number) {
  return `https://images.unsplash.com/${imageId}?auto=format&fit=crop&w=${width}&q=85`;
}

export function restaurantImage(restaurant: Restaurant) {
  const imageUrl = restaurant.imageUrl?.trim();
  if (imageUrl) return imageUrl;
  return unsplashImage(
    restaurantPhotos[Math.abs(restaurant.id) % restaurantPhotos.length],
    1200,
  );
}

export function menuItemImage(item: MenuItem) {
  const imageUrl = item.imageUrl?.trim();
  if (imageUrl) return imageUrl;

  const name = item.name.toLocaleLowerCase();
  const imageId =
    /biryani|pulao/.test(name) ? foodPhotos.biryani
      : /curry|masala|paneer|dal|sambar|korma/.test(name) ? foodPhotos.curry
        : /dosa|idli|uttapam/.test(name) ? foodPhotos.dosa
          : /salad|greens/.test(name) ? foodPhotos.salad
            : /pizza/.test(name) ? foodPhotos.pizza
              : /burger/.test(name) ? foodPhotos.burger
                : /cake|ice cream|gulab jamun|dessert/.test(name) ? foodPhotos.dessert
                  : /grill|tikka|kebab|roast/.test(name) ? foodPhotos.grilled
                    : /noodle|pasta|ramen/.test(name) ? foodPhotos.noodles
                      : foodPhotos.default;
  return unsplashImage(imageId, 720);
}

export const FALLBACK_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#ead9cd"/><stop offset="1" stop-color="#b65f43"/></linearGradient></defs><rect width="1200" height="800" fill="url(#a)"/><circle cx="600" cy="400" r="155" fill="#fffdfa" fill-opacity=".72"/><path d="M470 430c30-105 230-105 260 0-5 50-65 100-130 100s-125-50-130-100Z" fill="#d89a6b"/><circle cx="540" cy="400" r="20" fill="#78905c"/><circle cx="620" cy="370" r="24" fill="#b65f43"/><circle cx="675" cy="430" r="18" fill="#78905c"/></svg>',
)}`;
