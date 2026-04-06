import { supabase } from '../supabase'
import type { Employee } from '../types/employees'

class EmployeesService {
  async getByMatricula(matricula: string): Promise<Employee | null> {
    try {
      if (!matricula || matricula.trim().length === 0) {
        return null
      }

      const mat = matricula.trim()

      // First try employees table
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('matricula', mat)
        .eq('is_active', true)
        .single()

      if (!error && data) {
        return {
          ...data,
          department_name: data.department?.name || undefined
        } as Employee
      }

      // Fallback: try users table (matricula field)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, full_name, matricula, role, department_id')
        .eq('matricula', mat)
        .maybeSingle()

      if (!userError && userData) {
        // Get department name if exists
        let deptName = ''
        if (userData.department_id) {
          const { data: dept } = await supabase
            .from('departments')
            .select('name')
            .eq('id', userData.department_id)
            .single()
          deptName = dept?.name || ''
        }

        return {
          id: userData.id,
          matricula: userData.matricula || mat,
          full_name: userData.full_name,
          cargo: userData.role,
          is_active: true,
          department_name: deptName,
          created_at: '',
          updated_at: '',
        } as Employee
      }

      return null
    } catch (error) {
      console.error('EmployeesService: Error fetching employee:', error)
      return null
    }
  }

  async getAll(): Promise<Employee[]> {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          department:departments(name)
        `)
        .eq('is_active', true)
        .order('full_name', { ascending: true })

      if (error) {
        console.error('Error fetching employees:', error)
        return []
      }

      return (data || []).map(emp => ({
        ...emp,
        department_name: emp.department?.name || undefined
      })) as Employee[]
    } catch (error) {
      console.error('EmployeesService: Error fetching employees:', error)
      return []
    }
  }
}

export const employeesService = new EmployeesService()
