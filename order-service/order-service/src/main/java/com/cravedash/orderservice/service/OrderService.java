package com.cravedash.orderservice.service;

import com.cravedash.orderservice.dto.OrderItemDTO;
import com.cravedash.orderservice.dto.OrderItemResponseDTO;
import com.cravedash.orderservice.dto.OrderRequestDTO;
import com.cravedash.orderservice.dto.OrderResponseDTO;
import com.cravedash.orderservice.dto.PaymentResponseDTO;
import com.cravedash.orderservice.dto.RestaurantAvailabilityDTO;
import com.cravedash.orderservice.dto.RestaurantMenuItemDTO;
import com.cravedash.orderservice.model.Order;
import com.cravedash.orderservice.model.OrderItem;
import com.cravedash.orderservice.repository.OrderRepository;

import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OrderService {

    private final OrderRepository orderRepository;
    private final RestTemplate restTemplate;

    public OrderService(OrderRepository orderRepository, RestTemplate restTemplate) {
        this.orderRepository = orderRepository;
        this.restTemplate = restTemplate;
    }

    public OrderResponseDTO createOrder(
            OrderRequestDTO request, long customerId, String idempotencyKey) {
        validateRequest(request, customerId, idempotencyKey);

        Order existing = orderRepository.findByIdempotencyKey(idempotencyKey).orElse(null);
        if (existing != null) {
            if (!customerIdEquals(existing, customerId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Idempotency key is already in use");
            }
            ensureSameOrder(existing, request);
            if ("PAYMENT_PENDING".equals(existing.getStatus())) {
                reconcilePayment(existing);
            }
            return convertToResponse(existing);
        }

        RestaurantAvailabilityDTO availability;
        RestaurantMenuItemDTO[] menuItems;
        try {
            availability = restTemplate.getForObject(
                    "http://RESTAURANT-SERVICE/restaurants/"
                            + request.getRestaurantId() + "/availability",
                    RestaurantAvailabilityDTO.class);
            menuItems = restTemplate.getForObject(
                    "http://RESTAURANT-SERVICE/restaurants/"
                            + request.getRestaurantId() + "/menu",
                    RestaurantMenuItemDTO[].class);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Restaurant service is unavailable", exception);
        }

        if (availability == null
                || !request.getRestaurantId().equals(availability.getRestaurantId())) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Restaurant availability response was invalid");
        }
        if (!availability.isAvailable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Restaurant is not available");
        }
        if (menuItems == null) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Restaurant menu could not be loaded");
        }

        Map<Long, RestaurantMenuItemDTO> menuById = Arrays.stream(menuItems)
                .collect(Collectors.toMap(
                        RestaurantMenuItemDTO::getId, Function.identity(), (first, duplicate) -> first));
        Order order = new Order();
        order.setUserId(customerId);
        order.setCustomerId(customerId);
        order.setRestaurantId(request.getRestaurantId());
        order.setStatus("PAYMENT_PENDING");
        order.setCreatedAt(LocalDateTime.now());
        order.setIdempotencyKey(idempotencyKey);

        BigDecimal total = BigDecimal.ZERO;
        for (OrderItemDTO requestedItem : request.getItems()) {
            RestaurantMenuItemDTO menuItem = menuById.get(requestedItem.getMenuItemId());
            if (menuItem == null
                    || !menuItem.isAvailable()
                    || !request.getRestaurantId().equals(menuItem.getRestaurantId())
                    || !Double.isFinite(menuItem.getPrice())
                    || menuItem.getPrice() <= 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "A requested menu item is unavailable or has an invalid price");
            }

            OrderItem item = new OrderItem();
            item.setMenuItemId(menuItem.getId());
            item.setItemName(menuItem.getName());
            item.setQuantity(requestedItem.getQuantity());
            item.setPrice(menuItem.getPrice());
            order.getItems().add(item);
            total = total.add(BigDecimal.valueOf(menuItem.getPrice())
                    .multiply(BigDecimal.valueOf(requestedItem.getQuantity())));
        }

        double totalAmount = total.doubleValue();
        if (!Double.isFinite(totalAmount) || totalAmount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order total is invalid");
        }
        order.setTotalAmount(totalAmount);

        Order savedOrder;
        try {
            savedOrder = orderRepository.saveAndFlush(order);
        } catch (DataIntegrityViolationException exception) {
            Order concurrentOrder = orderRepository.findByIdempotencyKey(idempotencyKey)
                    .orElseThrow(() -> exception);
            if (!customerIdEquals(concurrentOrder, customerId)) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "Idempotency key is already in use");
            }
            ensureSameOrder(concurrentOrder, request);
            if ("PAYMENT_PENDING".equals(concurrentOrder.getStatus())) {
                reconcilePayment(concurrentOrder);
            }
            return convertToResponse(concurrentOrder);
        }
        reconcilePayment(savedOrder);
        return convertToResponse(savedOrder);
    }

    public OrderResponseDTO getOrderById(Long id, long customerId) {
        Order order = orderRepository.findById(id)
                .filter(candidate -> customerIdEquals(candidate, customerId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Order not found"));
        reconcileIfPending(order);
        return convertToResponse(order);
    }

    public List<OrderResponseDTO> getOrdersByUser(long customerId) {
        return orderRepository.findByCustomerId(customerId).stream()
                .map(order -> {
                    reconcileIfPending(order);
                    return convertToResponse(order);
                })
                .toList();
    }

    private void validateRequest(OrderRequestDTO request, long customerId, String key) {
        if (customerId <= 0) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "A valid customer identity is required");
        }
        if (request == null
                || request.getRestaurantId() == null
                || request.getRestaurantId() <= 0
                || request.getItems() == null
                || request.getItems().isEmpty()
                || request.getItems().stream().anyMatch(item ->
                        item == null
                                || item.getMenuItemId() == null
                                || item.getMenuItemId() <= 0
                                || item.getQuantity() <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order items and quantities are invalid");
        }
        if (key == null || !key.matches("[A-Za-z0-9._:-]{1,64}")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "A valid Idempotency-Key header is required");
        }
        if (!"SIMULATED".equals(request.getPaymentMethod())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Only the simulated payment method is supported");
        }
    }

    private void ensureSameOrder(Order existing, OrderRequestDTO request) {
        if (!existing.getRestaurantId().equals(request.getRestaurantId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Idempotency key was already used for a different order");
        }
        Map<String, Long> savedLines = existing.getItems().stream().collect(
                Collectors.groupingBy(
                        item -> item.getMenuItemId() + ":" + item.getQuantity(),
                        Collectors.counting()));
        Map<String, Long> requestedLines = request.getItems().stream().collect(
                Collectors.groupingBy(
                        item -> item.getMenuItemId() + ":" + item.getQuantity(),
                        Collectors.counting()));
        if (!savedLines.equals(requestedLines)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Idempotency key was already used for a different order");
        }
    }

    private void reconcilePayment(Order order) {
        List<PaymentResponseDTO> payments;
        try {
            PaymentResponseDTO[] response = restTemplate.getForObject(
                    "http://PAYMENT-SERVICE/payments/order/" + order.getId(),
                    PaymentResponseDTO[].class);
            payments = response == null ? List.of() : Arrays.asList(response);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Payment outcome is pending confirmation; retry with the same idempotency key",
                    exception);
        }

        if (payments.size() > 1) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Payment records require reconciliation");
        }
        if (!payments.isEmpty()) {
            updateOrderFromPayment(order, payments.get(0));
        }
    }

    private void reconcileIfPending(Order order) {
        if ("PAYMENT_PENDING".equals(order.getStatus())) {
            reconcilePayment(order);
        }
    }

    private void updateOrderFromPayment(Order order, PaymentResponseDTO payment) {
        if (payment == null
                || order.getId() == null
                || !order.getId().equals(payment.getOrderId())
                || order.getCustomerId() == null
                || !order.getCustomerId().equals(order.getUserId())
                || !order.getCustomerId().equals(payment.getUserId())
                || !Double.isFinite(order.getTotalAmount())
                || !Double.isFinite(payment.getAmount())
                || Double.compare(order.getTotalAmount(), payment.getAmount()) != 0) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Payment outcome could not be verified");
        }
        if ("SUCCESS".equals(payment.getStatus())) {
            order.setStatus("CONFIRMED");
        } else if ("FAILED".equals(payment.getStatus())) {
            order.setStatus("PAYMENT_FAILED");
        } else if ("PENDING".equals(payment.getStatus())) {
            order.setStatus("PAYMENT_PENDING");
        } else {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Payment outcome could not be verified");
        }
        if ("SUCCESS".equals(payment.getStatus()) || "FAILED".equals(payment.getStatus())) {
            orderRepository.save(order);
        }
    }

    private boolean customerIdEquals(Order order, long customerId) {
        return order.getCustomerId() != null && order.getCustomerId() == customerId;
    }

    private OrderResponseDTO convertToResponse(Order order) {
        OrderResponseDTO response = new OrderResponseDTO();
        response.setOrderId(order.getId());
        response.setUserId(order.getCustomerId());
        response.setRestaurantId(order.getRestaurantId());
        response.setTotalAmount(order.getTotalAmount());
        response.setStatus(order.getStatus());
        response.setCreatedAt(order.getCreatedAt());
        response.setItems(order.getItems().stream().map(item -> {
            OrderItemResponseDTO line = new OrderItemResponseDTO();
            line.setMenuItemId(item.getMenuItemId());
            line.setItemName(item.getItemName());
            line.setQuantity(item.getQuantity());
            line.setPrice(item.getPrice());
            return line;
        }).toList());
        return response;
    }
}
