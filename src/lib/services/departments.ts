import { supabase } from '../supabase';
import type { Department } from '../types/departments';

class DepartmentsService {
  async getAll(): Promise<Department[]> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        console.error('Database error fetching departments:', error);
        throw new Error(`Database error fetching departments: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('DepartmentsService: Database error fetching departments:', error);
      throw error;
    }
  }

  async create(department: Omit<Department, 'id' | 'created_at'>): Promise<Department> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .insert(department)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Database error creating department:', error);
        throw new Error('Erro ao criar setor: ' + error.message);
      }

      if (!data) {
        throw new Error('Setor não foi criado. Verifique suas permissões.');
      }

      return data;
    } catch (error) {
      console.error('DepartmentsService: Database error creating department:', error);
      throw error;
    }
  }

  async update(id: string, updates: Partial<Department>): Promise<Department> {
    try {
      const { data, error } = await supabase
        .from('departments')
        .update(updates)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Database error updating department:', error);
        throw new Error('Erro ao atualizar setor: ' + error.message);
      }

      if (!data) {
        throw new Error('Setor não atualizado. Verifique suas permissões.');
      }

      return data;
    } catch (error) {
      console.error('DepartmentsService: Database error updating department:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // 1. Desvincular usuarios deste setor (set department_id = null)
      const { error: usersErr } = await supabase
        .from('users')
        .update({ department_id: null })
        .eq('department_id', id);

      if (usersErr) {
        console.warn('Aviso ao desvincular usuarios:', usersErr.message);
      }

      // 2. Soft delete: marca setor como inativo
      // Mantem o registro para que solicitacoes antigas continuem com referencia
      const { error } = await supabase
        .from('departments')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        console.error('Erro ao excluir setor:', error);
        throw new Error('Erro ao excluir setor: ' + error.message);
      }
    } catch (error) {
      console.error('DepartmentsService: Database error deleting department:', error);
      throw error;
    }
  }

  async exportToCSV(departments: Department[]): Promise<string> {
    try {
      const headers = ['Nome', 'Descrição', 'Data de Criação']
      const rows = departments.map(dept => [
        dept.name,
        dept.description || 'Sem descrição',
        new Date(dept.created_at).toLocaleDateString('pt-BR')
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      return csvContent
    } catch (error) {
      console.error('Error in exportToCSV:', error)
      throw new Error('Erro ao exportar departamentos para CSV')
    }
  }
}

export const departmentsService = new DepartmentsService();