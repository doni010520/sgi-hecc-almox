import { supabase } from '../supabase'
import type { Employee } from '../types/employees'

class EmployeesService {
  async getByMatricula(matricula: string): Promise<Employee | null> {
    try {
      if (!matricula || matricula.trim().length === 0) {
        return null
      }

      const mat = matricula.trim()

      // Lookup via RPC security-definer (users/employees não são legíveis por anon;
      // a RPC entrega só o mínimo e funciona tanto no painel de TV público quanto logado)
      const { data, error } = await supabase.rpc('lookup_employee_by_matricula', { mat })

      if (!error && data && data.length > 0) {
        const e = data[0]
        return {
          id: e.id,
          matricula: e.matricula || mat,
          full_name: e.full_name,
          cargo: e.cargo,
          is_active: true,
          department_name: e.department_name || '',
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

  async searchByName(name: string): Promise<Employee[]> {
    try {
      if (!name || name.trim().length < 2) return []

      const q = name.trim()

      // Search in users table
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, matricula, role, department_id')
        .ilike('full_name', `%${q}%`)
        .limit(10)

      if (error || !data) return []

      // Get department names
      const deptIds = [...new Set(data.filter(u => u.department_id).map(u => u.department_id))]
      let deptMap: Record<string, string> = {}
      if (deptIds.length > 0) {
        const { data: depts } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', deptIds)
        if (depts) {
          deptMap = Object.fromEntries(depts.map(d => [d.id, d.name]))
        }
      }

      return data.map(u => ({
        id: u.id,
        matricula: u.matricula || '',
        full_name: u.full_name,
        cargo: u.role,
        is_active: true,
        department_name: u.department_id ? deptMap[u.department_id] || '' : '',
        created_at: '',
        updated_at: '',
      })) as Employee[]
    } catch (error) {
      console.error('EmployeesService: Error searching by name:', error)
      return []
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
