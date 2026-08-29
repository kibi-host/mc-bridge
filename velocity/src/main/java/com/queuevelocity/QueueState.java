package com.queuevelocity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

record QueueState(String queueId, String status, Long position, Long estimatedWaitSeconds, String failureReason, String backend) {
  private static final Pattern STRING = Pattern.compile("\\\"%s\\\"\\s*:\\s*\\\"([^\\\"]*)\\\"");
  private static final Pattern NUMBER = Pattern.compile("\\\"%s\\\"\\s*:\\s*(\\d+)");

  static QueueState parse(String json) {
    return new QueueState(string(json, "queueId"), string(json, "status"), number(json, "position"),
        number(json, "estimatedWaitSeconds"), string(json, "failureReason"), string(json, "backend"));
  }
  private static String string(String json, String name) {
    Matcher matcher = Pattern.compile(String.format(STRING.pattern(), Pattern.quote(name))).matcher(json);
    return matcher.find() ? matcher.group(1) : null;
  }
  private static Long number(String json, String name) {
    Matcher matcher = Pattern.compile(String.format(NUMBER.pattern(), Pattern.quote(name))).matcher(json);
    return matcher.find() ? Long.valueOf(matcher.group(1)) : null;
  }
}
