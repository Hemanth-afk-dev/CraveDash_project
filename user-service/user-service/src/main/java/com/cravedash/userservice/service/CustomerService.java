package com.cravedash.userservice.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.cravedash.userservice.dto.AuthResponse;
import com.cravedash.userservice.dto.CustomerResponse;
import com.cravedash.userservice.dto.LoginRequest;
import com.cravedash.userservice.dto.RegisterRequest;
import com.cravedash.userservice.model.Customer;
import com.cravedash.userservice.repository.CustomerRepository;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;

    public CustomerService(
            CustomerRepository customerRepository,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder) {
        this.customerRepository = customerRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());
        if (customerRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }
        String displayName = request.displayName().strip();
        if (displayName.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name must contain at least 2 characters");
        }

        Customer customer = new Customer();
        customer.setEmail(email);
        customer.setDisplayName(displayName);
        customer.setPasswordHash(passwordEncoder.encode(request.password()));

        Customer saved;
        try {
            saved = customerRepository.saveAndFlush(customer);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "An account with this email already exists", exception);
        }
        return issueToken(saved);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        Customer customer = customerRepository.findByEmail(email)
                .filter(candidate -> passwordEncoder.matches(
                        request.password(), candidate.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid email or password"));
        return issueToken(customer);
    }

    @Transactional(readOnly = true)
    public CustomerResponse getProfile(long customerId) {
        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found"));
        return toResponse(customer);
    }

    private AuthResponse issueToken(Customer customer) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("cravedash-user-service")
                .subject(customer.getEmail())
                .issuedAt(now)
                .expiresAt(now.plus(1, ChronoUnit.HOURS))
                .claim("customerId", customer.getId())
                .claim("role", "CUSTOMER")
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims))
                .getTokenValue();
        return new AuthResponse(token, "Bearer", toResponse(customer));
    }

    private CustomerResponse toResponse(Customer customer) {
        return new CustomerResponse(
                customer.getId(),
                customer.getEmail(),
                customer.getDisplayName());
    }

    private String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
