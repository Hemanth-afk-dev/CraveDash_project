package com.cravedash.orderservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import com.cravedash.orderservice.dto.OrderItemDTO;
import com.cravedash.orderservice.dto.OrderRequestDTO;
import com.cravedash.orderservice.dto.PaymentResponseDTO;
import com.cravedash.orderservice.dto.RestaurantAvailabilityDTO;
import com.cravedash.orderservice.dto.RestaurantMenuItemDTO;
import com.cravedash.orderservice.model.Order;
import com.cravedash.orderservice.model.OrderItem;
import com.cravedash.orderservice.repository.OrderRepository;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        lenient().when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            if (order.getId() == null) {
                order.setId(42L);
            }
            return order;
        });
        lenient().when(orderRepository.saveAndFlush(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            if (order.getId() == null) {
                order.setId(42L);
            }
            return order;
        });
        lenient().when(orderRepository.findByIdempotencyKey(anyString())).thenReturn(Optional.empty());
        lenient().when(restTemplate.getForObject(anyString(), eq(PaymentResponseDTO[].class)))
                .thenReturn(new PaymentResponseDTO[0]);
    }

    @Test
    void createsPendingOrderWithoutInitiatingPayment() {
        stubAvailableRestaurant();

        var response = orderService.createOrder(orderRequest(), 3L, "checkout-attempt-1");

        assertThat(response.getOrderId()).isEqualTo(42L);
        assertThat(response.getStatus()).isEqualTo("PAYMENT_PENDING");
        assertThat(response.getTotalAmount()).isEqualTo(25.0);

        ArgumentCaptor<Order> savedOrders = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).saveAndFlush(savedOrders.capture());
        Order persistedOrder = savedOrders.getValue();
        assertThat(persistedOrder.getItems()).singleElement()
                .extracting(item -> item.getPrice())
                .isEqualTo(12.5);
        assertThat(response.getItems().getFirst().getItemName()).isEqualTo("Menu item");
        verify(restTemplate, never()).postForObject(
                anyString(), any(), eq(PaymentResponseDTO.class));
    }

    @Test
    void retainsPendingOrderWhenPaymentOutcomeIsUnavailable() {
        stubAvailableRestaurant();
        when(restTemplate.getForObject(anyString(), eq(PaymentResponseDTO[].class)))
                .thenThrow(new ResourceAccessException("payment service unavailable"));

        assertThatThrownBy(() -> orderService.createOrder(
                orderRequest(), 3L, "checkout-attempt-2"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);

        ArgumentCaptor<Order> savedOrder = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).saveAndFlush(savedOrder.capture());
        assertThat(savedOrder.getValue().getStatus()).isEqualTo("PAYMENT_PENDING");
    }

    @Test
    void recordsExplicitPaymentFailure() {
        stubAvailableRestaurant();
        PaymentResponseDTO paymentResponse = new PaymentResponseDTO();
        paymentResponse.setOrderId(42L);
        paymentResponse.setUserId(3L);
        paymentResponse.setAmount(25.0);
        paymentResponse.setStatus("FAILED");
        when(restTemplate.getForObject(anyString(), eq(PaymentResponseDTO[].class)))
                .thenReturn(new PaymentResponseDTO[] { paymentResponse });

        var response = orderService.createOrder(orderRequest(), 3L, "checkout-attempt-3");

        assertThat(response.getStatus()).isEqualTo("PAYMENT_FAILED");
    }

    @Test
    void keepsOrderPendingWhenPaymentRecordIsPending() {
        stubAvailableRestaurant();
        PaymentResponseDTO paymentResponse = new PaymentResponseDTO();
        paymentResponse.setOrderId(42L);
        paymentResponse.setUserId(3L);
        paymentResponse.setAmount(25.0);
        paymentResponse.setStatus("PENDING");
        when(restTemplate.getForObject(anyString(), eq(PaymentResponseDTO[].class)))
                .thenReturn(new PaymentResponseDTO[] { paymentResponse });

        var response = orderService.createOrder(orderRequest(), 3L, "checkout-pending-payment");

        assertThat(response.getStatus()).isEqualTo("PAYMENT_PENDING");
    }

    @Test
    void orderDetailsAreHiddenFromOtherCustomers() {
        Order order = new Order();
        order.setId(42L);
        order.setUserId(3L);
        order.setCustomerId(3L);
        when(orderRepository.findById(42L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.getOrderById(42L, 4L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void idempotencyKeyCannotBeReusedByAnotherCustomer() {
        Order order = new Order();
        order.setId(42L);
        order.setUserId(3L);
        order.setCustomerId(3L);
        when(orderRepository.findByIdempotencyKey("shared-key"))
                .thenReturn(Optional.of(order));

        assertThatThrownBy(() -> orderService.createOrder(
                orderRequest(), 4L, "shared-key"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void legacyOrdersAreNotAssignedToNewCustomerIds() {
        Order legacyOrder = new Order();
        legacyOrder.setId(42L);
        legacyOrder.setUserId(3L);
        when(orderRepository.findById(42L)).thenReturn(Optional.of(legacyOrder));

        assertThatThrownBy(() -> orderService.getOrderById(42L, 3L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void rejectsNonPositiveOrderQuantitiesBeforeCallingOtherServices() {
        OrderRequestDTO request = orderRequest();
        request.getItems().getFirst().setQuantity(0);

        assertThatThrownBy(() -> orderService.createOrder(request, 3L, "invalid-quantity"))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(restTemplate, never()).getForObject(
                anyString(), eq(RestaurantAvailabilityDTO.class));
    }

    @Test
    void retryReconcilesTheExistingPaymentWithoutCreatingAnotherOrder() {
        Order existing = new Order();
        existing.setId(42L);
        existing.setUserId(3L);
        existing.setCustomerId(3L);
        existing.setRestaurantId(7L);
        existing.setStatus("PAYMENT_PENDING");
        existing.setTotalAmount(25.0);
        existing.setIdempotencyKey("checkout-attempt-1");
        OrderItem savedItem = new OrderItem();
        savedItem.setMenuItemId(9L);
        savedItem.setQuantity(2);
        savedItem.setPrice(12.5);
        existing.getItems().add(savedItem);
        when(orderRepository.findByIdempotencyKey("checkout-attempt-1"))
                .thenReturn(Optional.of(existing));

        PaymentResponseDTO payment = new PaymentResponseDTO();
        payment.setOrderId(42L);
        payment.setUserId(3L);
        payment.setAmount(25.0);
        payment.setStatus("SUCCESS");
        when(restTemplate.getForObject(anyString(), eq(PaymentResponseDTO[].class)))
                .thenReturn(new PaymentResponseDTO[] { payment });

        var response = orderService.createOrder(orderRequest(), 3L, "checkout-attempt-1");

        assertThat(response.getStatus()).isEqualTo("CONFIRMED");
        verify(orderRepository, never()).saveAndFlush(any(Order.class));
        verify(restTemplate, never()).postForObject(
                anyString(), any(), eq(PaymentResponseDTO.class));
    }

    private void stubAvailableRestaurant() {
        RestaurantAvailabilityDTO availability = new RestaurantAvailabilityDTO();
        availability.setRestaurantId(7L);
        availability.setAvailable(true);
        when(restTemplate.getForObject(anyString(), eq(RestaurantAvailabilityDTO.class)))
                .thenReturn(availability);

        RestaurantMenuItemDTO menuItem = new RestaurantMenuItemDTO();
        menuItem.setId(9L);
        menuItem.setRestaurantId(7L);
        menuItem.setName("Menu item");
        menuItem.setPrice(12.5);
        menuItem.setAvailable(true);
        when(restTemplate.getForObject(anyString(), eq(RestaurantMenuItemDTO[].class)))
                .thenReturn(new RestaurantMenuItemDTO[] { menuItem });
    }

    private OrderRequestDTO orderRequest() {
        OrderItemDTO item = new OrderItemDTO();
        item.setMenuItemId(9L);
        item.setItemName("Client-supplied name");
        item.setPrice(0.01);
        item.setQuantity(2);

        OrderRequestDTO request = new OrderRequestDTO();
        request.setRestaurantId(7L);
        request.setItems(new ArrayList<>(List.of(item)));
        request.setPaymentMethod("SIMULATED");
        return request;
    }
}
