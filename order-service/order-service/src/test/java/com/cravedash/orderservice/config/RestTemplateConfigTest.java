package com.cravedash.orderservice.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.client.MockClientHttpRequest;
import org.springframework.mock.http.client.MockClientHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class RestTemplateConfigTest {

    @AfterEach
    void clearRequestContext() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void forwardsCallerBearerTokenToDownstreamRequest() throws Exception {
        MockHttpServletRequest incomingRequest = new MockHttpServletRequest();
        incomingRequest.addHeader(HttpHeaders.AUTHORIZATION, "Bearer caller-token");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(incomingRequest));

        MockClientHttpRequest downstreamRequest = new MockClientHttpRequest(
                HttpMethod.POST,
                URI.create("http://PAYMENT-SERVICE/payments"));
        ClientHttpRequestInterceptor interceptor =
                new RestTemplateConfig().restTemplate().getInterceptors().getFirst();

        interceptor.intercept(
                downstreamRequest,
                new byte[0],
                (request, body) -> new MockClientHttpResponse(new byte[0], HttpStatus.OK));

        assertThat(downstreamRequest.getHeaders().getFirst(HttpHeaders.AUTHORIZATION))
                .isEqualTo("Bearer caller-token");
    }
}
