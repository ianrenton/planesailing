package com.ianrenton.planesailing.utils;

public class PrometheusMetricGenerator {

    /**
     * Generate a single metric for incorporation into the Prometheus metrics endpoint data.
     */
    public static String generate(String metricName, String metricDescription, String metricType, Object value) {
        return "# HELP " + metricName + " " + metricDescription + "\n" +
                "# TYPE " + metricName + " " + metricType + "\n" +
                metricName + " " + value.toString() + "\n";
    }

    private PrometheusMetricGenerator() {
    }
}
