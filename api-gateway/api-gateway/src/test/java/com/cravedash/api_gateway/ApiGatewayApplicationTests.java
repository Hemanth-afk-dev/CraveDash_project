package com.cravedash.apigateway;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.HttpServerErrorException;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "jwt.secret=0123456789abcdef0123456789abcdef",
        "eureka.client.enabled=false",
        "spring.cloud.discovery.enabled=false"
})
@AutoConfigureMockMvc
class ApiGatewayApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void protectedRoutesRejectRequestsWithoutJwt() throws Exception {
        mockMvc.perform(get("/orders/1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerProfileRequiresJwt() throws Exception {
        mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registrationAndLoginArePublicAndRoutedToUserService() throws Exception {
        assertThatThrownBy(() -> mockMvc.perform(post("/auth/register")
                        .contentType("application/json")
                        .content("""
                                {"email":"new@example.com","displayName":"New Customer","password":"correct-horse-42"}
                                """)))
                .hasRootCauseInstanceOf(HttpServerErrorException.class);
    }

    @Test
    void corsAllowsFrontendAndIdempotencyHeader() throws Exception {
        mockMvc.perform(options("/orders")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "authorization,content-type,idempotency-key"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Headers",
                        org.hamcrest.Matchers.containsStringIgnoringCase("Idempotency-Key")));
    }
}
