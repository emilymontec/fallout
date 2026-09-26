package com.bank.atlasbank;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        // SPA principal del frontend minimalista
        registry.addRedirectViewController("/", "/inicio");
        registry.addViewController("/inicio").setViewName("forward:/app/index.html");

        // Rutas de autenticación
        registry.addViewController("/login").setViewName("forward:/app/index.html");
        registry.addViewController("/registro").setViewName("forward:/app/index.html");

        // Rutas del módulo cliente
        registry.addViewController("/dashboard").setViewName("forward:/app/index.html");
        registry.addViewController("/cuentas").setViewName("forward:/app/index.html");
        registry.addViewController("/transferencias").setViewName("forward:/app/index.html");
        registry.addViewController("/movimientos").setViewName("forward:/app/index.html");
        registry.addViewController("/ahorro").setViewName("forward:/app/index.html");
        registry.addViewController("/perfil").setViewName("forward:/app/index.html");
        registry.addViewController("/tarjetas").setViewName("forward:/app/index.html");

        // Rutas de administración
        registry.addViewController("/admin").setViewName("forward:/app/index.html");
        registry.addViewController("/admin/monitoreo").setViewName("forward:/app/index.html");
        registry.addViewController("/admin/usuarios").setViewName("forward:/app/index.html");
    }
}
