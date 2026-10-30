package com.cravedash.paymentservice.service;

import com.cravedash.paymentservice.dto.PaymentRequestDTO;
import com.cravedash.paymentservice.dto.PaymentResponseDTO;
import com.cravedash.paymentservice.dto.OrderVerificationDTO;
import com.cravedash.paymentservice.model.Payment;
import com.cravedash.paymentservice.repository.PaymentRepository;

import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final RestTemplate restTemplate;

    public PaymentService(PaymentRepository paymentRepository, RestTemplate restTemplate) {
        this.paymentRepository = paymentRepository;
        this.restTemplate = restTemplate;
    }

    public PaymentResponseDTO processPayment(PaymentRequestDTO request, long customerId) {
        if (request == null
                || request.getOrderId() == null
                || request.getOrderId() <= 0
                || request.getUserId() == null
                || request.getUserId() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment request");
        }
        if (customerId <= 0 || !Long.valueOf(customerId).equals(request.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Payment customer does not match the authenticated customer");
        }
        if (!Double.isFinite(request.getAmount()) || request.getAmount() <= 0
                || !"SIMULATED".equals(request.getPaymentMethod())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid simulated payment request");
        }

        List<Payment> existing = paymentRepository.findByOrderId(request.getOrderId());
        if (!existing.isEmpty()) {
            return existingPayment(existing.get(0), request, customerId);
        }

        verifyPendingOrder(request, customerId);

        Payment payment = new Payment();

        payment.setOrderId(request.getOrderId());
        payment.setUserId(request.getUserId());
        payment.setCustomerId(customerId);
        payment.setAmount(request.getAmount());
        payment.setPaymentMethod(request.getPaymentMethod());
        payment.setStatus("SUCCESS");
        payment.setPaymentDate(LocalDateTime.now());

        Payment savedPayment;
        try {
            savedPayment = paymentRepository.saveAndFlush(payment);
        } catch (DataIntegrityViolationException exception) {
            List<Payment> concurrentPayment = paymentRepository.findByOrderId(request.getOrderId());
            if (!concurrentPayment.isEmpty()) {
                return existingPayment(concurrentPayment.get(0), request, customerId);
            }
            throw exception;
        }

        return convertToResponse(savedPayment);
    }

    public PaymentResponseDTO getPaymentById(Long id, long customerId) {

        Payment payment = paymentRepository.findById(id)
                .filter(candidate -> candidate.getUserId() != null
                        && candidate.getCustomerId() != null
                        && candidate.getCustomerId() == customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Payment not found"));

        return convertToResponse(payment);
    }

    public List<PaymentResponseDTO> getPaymentsByOrder(Long orderId, long customerId) {

        return paymentRepository.findByOrderId(orderId)
                .stream()
                .filter(payment -> payment.getCustomerId() != null
                        && payment.getCustomerId() == customerId)
                .map(this::convertToResponse)
                .toList();
    }

    public List<PaymentResponseDTO> getPaymentsByUser(long userId, long customerId) {
        if (userId != customerId) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Payments can only be viewed by their customer");
        }

        return paymentRepository.findByUserId(userId).stream()
                .filter(payment -> payment.getCustomerId() != null
                        && payment.getCustomerId() == customerId)
                .map(this::convertToResponse)
                .toList();
    }

    private PaymentResponseDTO existingPayment(
            Payment payment, PaymentRequestDTO request, long customerId) {
        if (!Long.valueOf(customerId).equals(payment.getCustomerId())
                || !request.getOrderId().equals(payment.getOrderId())
                || Double.compare(request.getAmount(), payment.getAmount()) != 0
                || !request.getPaymentMethod().equals(payment.getPaymentMethod())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "A different payment is already recorded for this order");
        }
        return convertToResponse(payment);
    }

    private void verifyPendingOrder(PaymentRequestDTO request, long customerId) {
        OrderVerificationDTO order;
        try {
            order = restTemplate.getForObject(
                    "http://ORDER-SERVICE/orders/" + request.getOrderId(),
                    OrderVerificationDTO.class);
        } catch (HttpClientErrorException.NotFound exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found", exception);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "Order could not be verified", exception);
        }
        if (order == null
                || !request.getOrderId().equals(order.getOrderId())
                || !Long.valueOf(customerId).equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found");
        }
        if (!"PAYMENT_PENDING".equals(order.getStatus())
                || !Double.isFinite(order.getTotalAmount())
                || Double.compare(request.getAmount(), order.getTotalAmount()) != 0) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Payment must match the pending order total");
        }
    }

    private PaymentResponseDTO convertToResponse(Payment payment) {

        PaymentResponseDTO response = new PaymentResponseDTO();

        response.setPaymentId(payment.getId());
        response.setOrderId(payment.getOrderId());
        response.setUserId(payment.getUserId());
        response.setAmount(payment.getAmount());
        response.setPaymentMethod(payment.getPaymentMethod());
        response.setStatus(payment.getStatus());
        response.setPaymentDate(payment.getPaymentDate());

        return response;
    }
}