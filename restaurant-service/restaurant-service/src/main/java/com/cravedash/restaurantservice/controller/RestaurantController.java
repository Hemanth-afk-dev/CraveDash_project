package com.cravedash.restaurantservice.controller;

import com.cravedash.restaurantservice.dto.MenuItemDTO;
import com.cravedash.restaurantservice.dto.RestaurantAvailabilityDTO;
import com.cravedash.restaurantservice.dto.RestaurantResponseDTO;
import com.cravedash.restaurantservice.model.MenuItem;
import com.cravedash.restaurantservice.model.Restaurant;
import com.cravedash.restaurantservice.service.RestaurantService;

import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequestMapping("/restaurants")
public class RestaurantController {

    private final RestaurantService restaurantService;

    public RestaurantController(RestaurantService restaurantService) {
        this.restaurantService = restaurantService;
    }

    @GetMapping
    public List<RestaurantResponseDTO> getAllRestaurants() {
        return restaurantService.getAllRestaurants();
    }

    @GetMapping("/{id}")
    public RestaurantResponseDTO getRestaurant(@PathVariable Long id) {
        return restaurantService.getRestaurantById(id);
    }

    @PostMapping
    public RestaurantResponseDTO createRestaurant(
            @Valid @RequestBody Restaurant restaurant) {
        return restaurantService.createRestaurant(restaurant);
    }

    @GetMapping("/{id}/menu")
    public List<MenuItemDTO> getMenu(@PathVariable Long id) {
        return restaurantService.getMenuByRestaurant(id);
    }

    @PostMapping("/{id}/menu")
    public MenuItemDTO addMenuItem(
            @PathVariable Long id,
            @Valid @RequestBody MenuItem menuItem) {

        return restaurantService.addMenuItem(id, menuItem);
    }

    @GetMapping("/{id}/availability")
    public RestaurantAvailabilityDTO checkAvailability(
            @PathVariable Long id) {

        return restaurantService.checkAvailability(id);
    }
}