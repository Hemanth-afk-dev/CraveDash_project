package com.cravedash.userservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.cravedash.userservice.model.Customer;
import com.cravedash.userservice.repository.CustomerRepository;

@SpringBootTest(properties = {
        "jwt.secret=0123456789abcdef0123456789abcdef",
        "spring.datasource.url=jdbc:h2:mem:cravedash-users;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@AutoConfigureMockMvc
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private CustomerRepository customerRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void clearCustomers() {
        customerRepository.deleteAll();
    }

    @Test
    void registrationPersistsHashedPasswordAndLoginTokenIdentifiesCustomer() throws Exception {
        String response = mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"Taylor@example.com","displayName":"Taylor","password":"correct-horse-42"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.type").value("Bearer"))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.customer.id").isNumber())
                .andExpect(jsonPath("$.customer.email").value("taylor@example.com"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Customer customer = customerRepository.findByEmail("taylor@example.com").orElseThrow();
        assertThat(customer.getPasswordHash()).isNotEqualTo("correct-horse-42");
        assertThat(passwordEncoder.matches("correct-horse-42", customer.getPasswordHash())).isTrue();

        String token = com.fasterxml.jackson.databind.json.JsonMapper.builder()
                .build()
                .readTree(response)
                .get("token")
                .asText();
        mockMvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(customer.getId()))
                .andExpect(jsonPath("$.email").value("taylor@example.com"))
                .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void duplicateEmailIsRejectedCaseInsensitively() throws Exception {
        register("taylor@example.com");

        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"TAYLOR@example.com","displayName":"Another Taylor","password":"another-password"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An account with this email already exists"));

        assertThat(customerRepository.count()).isEqualTo(1);
    }

    @Test
    void invalidRegistrationAndIncorrectLoginAreRejected() throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"not-an-email","displayName":"A","password":"short"}
                                """))
                .andExpect(status().isBadRequest());

        register("taylor@example.com");
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"taylor@example.com","password":"wrong-password"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    private void register(String email) throws Exception {
        mockMvc.perform(post("/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","displayName":"Taylor","password":"correct-horse-42"}
                                """.formatted(email)))
                .andExpect(status().isCreated());
    }
}
