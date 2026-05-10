package com.diquan.backend;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;

@Service
class AuthService {
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final ObjectMapper objectMapper;
    private final byte[] secret;

    AuthService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.secret = System.getenv().getOrDefault("JWT_SECRET", "diquan_secret_key").getBytes(StandardCharsets.UTF_8);
    }

    String token(long id, String role, String phone) {
        try {
            String header = encodeJson(Map.of("alg", "HS256", "typ", "JWT"));
            long exp = Instant.now().plusSeconds(7 * 24 * 60 * 60).getEpochSecond();
            String payload = encodeJson(Map.of("id", id, "role", role, "phone", phone, "exp", exp));
            String unsigned = header + "." + payload;
            return unsigned + "." + URL_ENCODER.encodeToString(sign(unsigned));
        } catch (Exception error) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Token 生成失败");
        }
    }

    AuthenticatedUser requireUser(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "No token provided");
        }
        return verify(authorization.substring("Bearer ".length()));
    }

    AuthenticatedUser requireRole(HttpServletRequest request, String... roles) {
        AuthenticatedUser user = requireUser(request);
        if (Arrays.stream(roles).noneMatch(user.role()::equals)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Permission denied");
        }
        return user;
    }

    private AuthenticatedUser verify(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) throw new IllegalArgumentException("Bad token");

            String unsigned = parts[0] + "." + parts[1];
            byte[] expected = sign(unsigned);
            byte[] actual = URL_DECODER.decode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) {
                throw new IllegalArgumentException("Bad signature");
            }

            Map<String, Object> claims = objectMapper.readValue(URL_DECODER.decode(parts[1]), new TypeReference<>() {
            });
            long exp = Values.longValue(claims.get("exp"));
            if (exp < Instant.now().getEpochSecond()) {
                throw new IllegalArgumentException("Expired token");
            }

            return new AuthenticatedUser(
                Values.longValue(claims.get("id")),
                String.valueOf(claims.get("role")),
                String.valueOf(claims.get("phone"))
            );
        } catch (Exception error) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }
    }

    private String encodeJson(Map<String, ?> value) throws Exception {
        return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
    }

    private byte[] sign(String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret, "HmacSHA256"));
        return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    }
}
