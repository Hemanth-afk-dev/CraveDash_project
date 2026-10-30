package com.cravedash.restaurantservice;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "jwt.secret=0123456789abcdef0123456789abcdef")
@AutoConfigureMockMvc
class RestaurantServiceApplicationTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void contextLoads() {
	}

	@Test
	void restaurantEndpointsRequireJwt() throws Exception {
		mockMvc.perform(get("/restaurants"))
				.andExpect(status().isUnauthorized());
	}

}
