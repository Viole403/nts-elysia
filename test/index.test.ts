import { describe, expect, it } from 'bun:test'
import app from '../src/index'

describe('Elysia App', () => {
    it('should return a welcome message for /admin/dashboard', async () => {
        const response = await app
            .handle(new Request('http://localhost/admin/dashboard', {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImVtYWlsIjoiYWRtaW5AZXhhbXBsZS5jb20iLCJyb2xlIjoiQURNSU4iLCJpYXQiOjE3MTk3NzYwMDAsImV4cCI6MTcxOTc3NjkxMH0.dummy_token_for_admin_role' // Replace with a valid admin token
                }
            }))
            .then((res) => res.text())

        expect(response).toBe('Welcome to the admin dashboard!')
    })

    it('should return 401 for unauthorized access to /admin/dashboard', async () => {
        const response = await app
            .handle(new Request('http://localhost/admin/dashboard'))
            .then((res) => res.status)

        expect(response).toBe(401)
    })

    it('should return 403 for insufficient permissions to /admin/dashboard', async () => {
        const response = await app
            .handle(new Request('http://localhost/admin/dashboard', {
                headers: {
                    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjQ1NiIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInJvbGUiOiJVU0VSIiwiaWF0IjoxNzE5Nzc2MDAwLCJleHAiOjE3MTk3NzY5MTB9.dummy_token_for_user_role' // Replace with a valid user token
                }
            }))
            .then((res) => res.status)

        expect(response).toBe(403)
    })

    it('should return 200 for /health-check', async () => {
        const response = await app
            .handle(new Request('http://localhost/health-check'))
            .then((res) => res.status)

        expect(response).toBe(200)
    })
})