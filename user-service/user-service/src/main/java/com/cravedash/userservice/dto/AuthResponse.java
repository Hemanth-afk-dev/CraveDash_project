package com.cravedash.userservice.dto;

public record AuthResponse(String token, String type, CustomerResponse customer) {
}
