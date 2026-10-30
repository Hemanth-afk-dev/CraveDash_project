package com.cravedash.restaurantservice.service;

import com.cravedash.restaurantservice.dto.MenuItemDTO;
import com.cravedash.restaurantservice.dto.RestaurantAvailabilityDTO;
import com.cravedash.restaurantservice.dto.RestaurantResponseDTO;
import com.cravedash.restaurantservice.model.MenuItem;
import com.cravedash.restaurantservice.model.Restaurant;
import com.cravedash.restaurantservice.repository.MenuItemRepository;
import com.cravedash.restaurantservice.repository.RestaurantRepository;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;

    public RestaurantService(RestaurantRepository restaurantRepository,
                             MenuItemRepository menuItemRepository) {
        this.restaurantRepository = restaurantRepository;
        this.menuItemRepository = menuItemRepository;
    }

    public List<RestaurantResponseDTO> getAllRestaurants() {

        return restaurantRepository.findAll()
                .stream()
                .map(this::convertToRestaurantDTO)
                .toList();
    }

    public RestaurantResponseDTO getRestaurantById(Long id) {

        Restaurant restaurant = restaurantRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurant not found"));

        return convertToRestaurantDTO(restaurant);
    }

    public RestaurantResponseDTO createRestaurant(Restaurant restaurant) {

        Restaurant savedRestaurant = restaurantRepository.save(restaurant);

        return convertToRestaurantDTO(savedRestaurant);
    }

    public List<MenuItemDTO> getMenuByRestaurant(Long restaurantId) {
        if (!restaurantRepository.existsById(restaurantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Restaurant not found");
        }

        return menuItemRepository.findByRestaurantId(restaurantId)
                .stream()
                .map(this::convertToMenuItemDTO)
                .toList();
    }

    public MenuItemDTO addMenuItem(Long restaurantId, MenuItem menuItem) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurant not found"));
        if (menuItem.getName().trim().equalsIgnoreCase(restaurant.getName().trim())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A menu item cannot duplicate the restaurant name");
        }

        menuItem.setRestaurantId(restaurantId);

        MenuItem savedMenuItem = menuItemRepository.save(menuItem);

        return convertToMenuItemDTO(savedMenuItem);
    }

    public RestaurantAvailabilityDTO checkAvailability(Long restaurantId) {

        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Restaurant not found"));

        RestaurantAvailabilityDTO dto = new RestaurantAvailabilityDTO();

        dto.setRestaurantId(restaurant.getId());
        dto.setAvailable(restaurant.isAvailable());

        return dto;
    }

    private RestaurantResponseDTO convertToRestaurantDTO(Restaurant restaurant) {

        RestaurantResponseDTO dto = new RestaurantResponseDTO();

        dto.setId(restaurant.getId());
        dto.setName(restaurant.getName());
        dto.setAddress(restaurant.getAddress());
        dto.setPhone(restaurant.getPhone());
        dto.setAvailable(restaurant.isAvailable());
        dto.setImageUrl(restaurant.getImageUrl());
        return dto;
    }

    private MenuItemDTO convertToMenuItemDTO(MenuItem menuItem) {

        MenuItemDTO dto = new MenuItemDTO();

        dto.setId(menuItem.getId());
        dto.setRestaurantId(menuItem.getRestaurantId());
        dto.setName(menuItem.getName());
        dto.setDescription(menuItem.getDescription());
        dto.setPrice(menuItem.getPrice());
        dto.setAvailable(menuItem.isAvailable());
        dto.setImageUrl(menuItem.getImageUrl());
        return dto;
    }
}