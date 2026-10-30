package com.cravedash.restaurant_service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import com.cravedash.restaurantservice.model.MenuItem;
import com.cravedash.restaurantservice.model.Restaurant;
import com.cravedash.restaurantservice.repository.MenuItemRepository;
import com.cravedash.restaurantservice.repository.RestaurantRepository;
import com.cravedash.restaurantservice.service.RestaurantService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class RestaurantServiceTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @InjectMocks
    private RestaurantService restaurantService;

    @Test
    void includesRestaurantAndMenuImageUrlsInApiDtos() {
        Restaurant restaurant = new Restaurant();
        restaurant.setId(5L);
        restaurant.setName("Saffron & Stone");
        restaurant.setAddress("Market Road");
        restaurant.setPhone("555-0105");
        restaurant.setAvailable(true);
        restaurant.setImageUrl("https://images.example.test/restaurant.jpg");
        when(restaurantRepository.save(any(Restaurant.class))).thenReturn(restaurant);

        var restaurantResponse = restaurantService.createRestaurant(restaurant);

        assertThat(restaurantResponse.getImageUrl())
                .isEqualTo("https://images.example.test/restaurant.jpg");

        when(restaurantRepository.findById(5L)).thenReturn(Optional.of(restaurant));
        MenuItem menuItem = new MenuItem();
        menuItem.setName("Paneer Tikka");
        menuItem.setDescription("Chargrilled paneer with house spices.");
        menuItem.setPrice(275);
        menuItem.setAvailable(true);
        menuItem.setImageUrl("https://images.example.test/paneer.jpg");
        when(menuItemRepository.save(any(MenuItem.class))).thenAnswer(invocation -> {
            MenuItem saved = invocation.getArgument(0);
            saved.setId(20L);
            return saved;
        });

        var menuResponse = restaurantService.addMenuItem(5L, menuItem);

        assertThat(menuResponse.getRestaurantId()).isEqualTo(5L);
        assertThat(menuResponse.getImageUrl())
                .isEqualTo("https://images.example.test/paneer.jpg");
    }

    @Test
    void rejectsMenuItemNamedAfterItsRestaurant() {
        Restaurant restaurant = new Restaurant();
        restaurant.setId(5L);
        restaurant.setName("Saffron & Stone");
        when(restaurantRepository.findById(5L)).thenReturn(Optional.of(restaurant));
        MenuItem menuItem = new MenuItem();
        menuItem.setName(" saffron & stone ");
        menuItem.setPrice(100);

        assertThatThrownBy(() -> restaurantService.addMenuItem(5L, menuItem))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception ->
                        ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(menuItemRepository, never()).save(any(MenuItem.class));
    }
}
