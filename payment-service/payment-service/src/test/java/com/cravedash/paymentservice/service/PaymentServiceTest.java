package com.cravedash.paymentservice.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import com.cravedash.paymentservice.dto.PaymentRequestDTO;
import com.cravedash.paymentservice.dto.OrderVerificationDTO;
import com.cravedash.paymentservice.model.Payment;
import com.cravedash.paymentservice.repository.PaymentRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestTemplate;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private PaymentService paymentService;

    @Test
    void recordsOneSimulatedPaymentForAnOrder() {
        when(paymentRepository.findByOrderId(71L)).thenReturn(List.of());
        OrderVerificationDTO verifiedOrder = new OrderVerificationDTO();
        verifiedOrder.setOrderId(71L);
        verifiedOrder.setUserId(12L);
        verifiedOrder.setTotalAmount(31.5);
        verifiedOrder.setStatus("PAYMENT_PENDING");
        when(restTemplate.getForObject(anyString(), eq(OrderVerificationDTO.class)))
                .thenReturn(verifiedOrder);
        when(paymentRepository.saveAndFlush(any(Payment.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        var response = paymentService.processPayment(request(), 12L);

        assertThat(response.getOrderId()).isEqualTo(71L);
        assertThat(response.getUserId()).isEqualTo(12L);
        assertThat(response.getAmount()).isEqualTo(31.5);
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(paymentRepository).saveAndFlush(any(Payment.class));
    }

    @Test
    void repeatedRequestReturnsExistingPaymentWithoutCreatingAnother() {
        Payment payment = new Payment();
        payment.setId(5L);
        payment.setOrderId(71L);
        payment.setUserId(12L);
        payment.setCustomerId(12L);
        payment.setAmount(31.5);
        payment.setPaymentMethod("SIMULATED");
        payment.setStatus("SUCCESS");
        when(paymentRepository.findByOrderId(71L)).thenReturn(List.of(payment));

        var response = paymentService.processPayment(request(), 12L);

        assertThat(response.getPaymentId()).isEqualTo(5L);
        assertThat(response.getStatus()).isEqualTo("SUCCESS");
        verify(paymentRepository, never()).saveAndFlush(any(Payment.class));
    }

    @Test
    void rejectsClientSuppliedIdentityThatDoesNotMatchJwt() {
        assertThatThrownBy(() -> paymentService.processPayment(request(), 13L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void doesNotRecordPaymentForAnIncorrectOrderTotal() {
        when(paymentRepository.findByOrderId(71L)).thenReturn(List.of());
        OrderVerificationDTO verifiedOrder = new OrderVerificationDTO();
        verifiedOrder.setOrderId(71L);
        verifiedOrder.setUserId(12L);
        verifiedOrder.setTotalAmount(32.0);
        verifiedOrder.setStatus("PAYMENT_PENDING");
        when(restTemplate.getForObject(anyString(), eq(OrderVerificationDTO.class)))
                .thenReturn(verifiedOrder);

        assertThatThrownBy(() -> paymentService.processPayment(request(), 12L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        verify(paymentRepository, never()).saveAndFlush(any(Payment.class));
    }

    @Test
    void rejectsInvalidPaymentAmounts() {
        PaymentRequestDTO request = request();
        request.setAmount(0);

        assertThatThrownBy(() -> paymentService.processPayment(request, 12L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(exception -> ((ResponseStatusException) exception).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        verify(paymentRepository, never()).saveAndFlush(any(Payment.class));
    }

    private PaymentRequestDTO request() {
        PaymentRequestDTO request = new PaymentRequestDTO();
        request.setOrderId(71L);
        request.setUserId(12L);
        request.setAmount(31.5);
        request.setPaymentMethod("SIMULATED");
        return request;
    }
}
