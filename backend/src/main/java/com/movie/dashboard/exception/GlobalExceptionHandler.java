package com.movie.dashboard.exception;

import jakarta.persistence.EntityNotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.stream.Collectors;

/**
 * 全局异常处理器。
 * <p>
 * 所有未被 Controller 内部 catch 的异常都统一转换为 {@link Result} 格式返回，
 * 保证前端无论成功失败都能拿到 {code, message, data} 结构。
 * </p>
 * <p>
 * 注意：对外不暴露堆栈和技术细节，详细信息只写入服务端日志，避免信息泄漏。
 * </p>
 */
@ControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 处理 JPA 实体不存在异常（查不到电影 / 类型等）。
     */
    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<Result<Void>> handleEntityNotFound(EntityNotFoundException ex) {
        log.warn("资源不存在: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Result.error(404, "资源不存在: " + ex.getMessage()));
    }

    /**
     * 处理 @Valid 参数校验异常（请求体字段不合法）。
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(400, "参数校验失败: " + msg));
    }

    /**
     * 处理类型不匹配异常：例如 /api/movies/abc 这种非法路径变量。
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Result<Void>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("参数类型错误: name={}, value={}", ex.getName(), ex.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(400, "参数 " + ex.getName() + " 格式不正确"));
    }

    /**
     * 处理必填查询参数缺失异常。
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<Result<Void>> handleMissingParam(MissingServletRequestParameterException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(400, "缺少必需的参数: " + ex.getParameterName()));
    }

    /**
     * 处理非法参数异常。
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Result<Void>> handleIllegalArg(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Result.error(400, ex.getMessage()));
    }

    /**
     * 处理"接口不存在"（路径写错 / 后端未升级导致新接口缺失）。
     * <p>
     * Spring Boot 3 中未匹配的路径会抛 NoResourceFoundException，
     * 若不单独处理会被兜底分支转成 500，前端就无法区分
     * "接口不存在"与"服务器内部错误"，这里统一返回 404。
     * </p>
     */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<Result<Void>> handleNotFound(Exception ex) {
        log.warn("接口不存在: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Result.error(404, "接口不存在"));
    }

    /**
     * 兜底：处理所有其它运行时异常。
     * 详细堆栈写入日志，响应体只给通用提示，避免向前端泄漏内部实现细节。
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleAll(Exception ex) {
        log.error("服务器内部错误: {}", ex.getMessage(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.error(500, "服务器内部错误，请查看服务端日志"));
    }
}
