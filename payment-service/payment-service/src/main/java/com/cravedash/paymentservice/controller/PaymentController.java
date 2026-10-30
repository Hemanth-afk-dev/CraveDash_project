package com.cravedash.paymentservice.controller;

import com.cravedash.paymentservice.dto.PaymentRequestDTO;
import com.cravedash.paymentservice.dto.PaymentResponseDTO;
import com.cravedash.paymentservice.service.PaymentService;

import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping
    public PaymentResponseDTO processPayment(
            @Valid @RequestBody PaymentRequestDTO request,
            @AuthenticationPrincipal Jwt jwt) {

        return paymentService.processPayment(request, customerId(jwt));
    }

    @GetMapping("/{id}")
    public PaymentResponseDTO getPayment(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt) {

        return paymentService.getPaymentById(id, customerId(jwt));
    }

    @GetMapping("/order/{orderId}")
    public List<PaymentResponseDTO> getPaymentsByOrder(
            @PathVariable Long orderId,
            @AuthenticationPrincipal Jwt jwt) {

        return paymentService.getPaymentsByOrder(orderId, customerId(jwt));
    }

    @GetMapping("/user/{userId}")
    public List<PaymentResponseDTO> getPaymentsByUser(
            @PathVariable Long userId,
            @AuthenticationPrincipal Jwt jwt) {

        return paymentService.getPaymentsByUser(userId, customerId(jwt));
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