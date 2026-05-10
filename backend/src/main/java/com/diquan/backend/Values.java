package com.diquan.backend;

import java.util.Map;

class Values {
    private Values() {
    }

    static String text(Map<String, Object> body, String key) {
        Object value = body.get(key);
        return value == null ? null : String.valueOf(value);
    }

    static String text(Map<String, Object> body, String key, String fallback) {
        String value = text(body, key);
        return value == null || value.isBlank() ? fallback : value;
    }

    static long longValue(Object value) {
        if (value instanceof Number number) return number.longValue();
        return Long.parseLong(String.valueOf(value));
    }

    static int intValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    static int intValue(Map<String, Object> body, String key, int fallback) {
        Object value = body.get(key);
        return value == null ? fallback : intValue(value);
    }

    static double doubleValue(Object value) {
        if (value instanceof Number number) return number.doubleValue();
        return Double.parseDouble(String.valueOf(value));
    }

    static double doubleValue(Map<String, Object> body, String key, double fallback) {
        Object value = body.get(key);
        return value == null ? fallback : doubleValue(value);
    }

    static boolean bool(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value instanceof Boolean bool) return bool;
        if (value instanceof Number number) return number.intValue() != 0;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
