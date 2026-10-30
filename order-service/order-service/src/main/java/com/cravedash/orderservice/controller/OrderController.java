package com.cravedash.orderservice.controller;

import com.cravedash.orderservice.dto.OrderRequestDTO;
import com.cravedash.orderservice.dto.OrderResponseDTO;
import com.cravedash.orderservice.service.OrderService;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;

import java.util.List;

@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping
    public OrderResponseDTO createOrder(
            @Valid @RequestBody OrderRequestDTO request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @AuthenticationPrincipal Jwt jwt) {
        return orderService.createOrder(request, customerId(jwt), idempotencyKey);
    }

    @GetMapping("/{id}")
    public OrderResponseDTO getOrder(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {
        return orderService.getOrderById(id, customerId(jwt));
    }

    @GetMapping("/mine")
    public List<OrderResponseDTO> getMyOrders(@AuthenticationPrincipal Jwt jwt) {
        return orderService.getOrdersByUser(customerId(jwt));
    }

    @GetMapping("/user/{userId}")
    public List<OrderResponseDTO> getOrdersByUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal Jwt jwt) {
        long customerId = customerId(jwt);
        if (userId != customerId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Orders can only be viewed by their customer");
        }
        return orderService.getOrdersByUser(customerId);
    }

    private long customerId(Jwt jwt) {
        Object claim = jwt.getClaim("customerId");
        Object role = jwt.getClaim("role");
        if (!(claim instanceof Number id) || id.longValue() <= 0
                || !"CUSTOMER".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "A valid customer identity is required");
        }
        return id.longValue();
    }
}