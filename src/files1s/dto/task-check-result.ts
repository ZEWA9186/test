export interface TaskCheckResult {
    success: boolean;
    errors?: string[];
    items?: string[];
    message?: string;
}