package com.cravedash.userservice.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.cravedash.userservice.dto.AuthResponse;
import com.cravedash.userservice.dto.CustomerResponse;
import com.cravedash.userservice.dto.LoginRequest;
import com.cravedash.userservice.dto.RegisterRequest;
import com.cravedash.userservice.service.CustomerService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final CustomerService customerService;

    public AuthController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
            @Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(customerService.register(request));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return customerService.login(request);
    }

    @GetMapping("/me")
    public CustomerResponse me(@AuthenticationPrincipal Jwt jwt) {
        Object claim = jwt.getClaim("customerId");
        if (!(claim instanceof Number customerId) || customerId.longValue() <= 0) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Customer identity is missing from this token");
        }
        return customerService.getProfile(customerId.longValue());
    }
}
