class ApiError extends Error {
    constructor(
        statusCode, 
        message = 'Something went wrong!',
        errors = [],
        stackTrace = ''
    ) {
        super(message),
        this.statusCode = statusCode
        this.message = message
        this.errors = errors
        this.data = null
        this.success = false

        if(stackTrace) {
            this.stack = stackTrace
        }else {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export default ApiError
