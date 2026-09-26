package com.bank.atlasbank;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies which static paths are served (200) and which are not (404).
 *
 * Key regression guard: atlasbank_front/ lives at the repo root, outside
 * src/main/resources/static/. It must never accidentally become reachable
 * (e.g. via an addResourceHandlers() entry in WebConfig).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StaticResourceServingIT {

    @Autowired
    private MockMvc mockMvc;

    // --- Pages that MUST be reachable ---

    @Test
    void landingPageIsServed() throws Exception {
        mockMvc.perform(get("/inicio.html"))
                .andExpect(status().isOk());
    }

    @Test
    void loginPageIsServed() throws Exception {
        mockMvc.perform(get("/auth/login.html"))
                .andExpect(status().isOk());
    }

    @Test
    void mainStylesheetIsServed() throws Exception {
        mockMvc.perform(get("/assets/css/styles.css"))
                .andExpect(status().isOk());
    }

    @Test
    void commonStylesheetIsServed() throws Exception {
        mockMvc.perform(get("/common/styles.css"))
                .andExpect(status().isOk());
    }

    // --- atlasbank_front/ pages must NOT be reachable as HTTP 200 ---
    // These files sit at the repo root, not inside src/main/resources/static/.
    // If any of these return 200, a resource handler was added without review.
    // The app may return 404 or 500 for unresolved resources depending on the
    // error handler, but it must never return 200 (i.e. actually serve them).

    @Test
    void atlasbank_front_loginIsNotServed() throws Exception {
        mockMvc.perform(get("/atlasbank_front/login.html"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        throw new AssertionError(
                            "atlasbank_front/login.html must not be served, but got HTTP 200");
                    }
                });
    }

    @Test
    void atlasbank_front_dashboardIsNotServed() throws Exception {
        mockMvc.perform(get("/atlasbank_front/dashboard.html"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        throw new AssertionError(
                            "atlasbank_front/dashboard.html must not be served, but got HTTP 200");
                    }
                });
    }

    @Test
    void atlasbank_front_adminIsNotServed() throws Exception {
        mockMvc.perform(get("/atlasbank_front/panel_admin.html"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 200) {
                        throw new AssertionError(
                            "atlasbank_front/panel_admin.html must not be served, but got HTTP 200");
                    }
                });
    }
}
