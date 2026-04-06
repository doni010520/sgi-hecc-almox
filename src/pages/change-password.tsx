import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ShieldCheck } from 'lucide-react'

export function ChangePassword() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError('A senha deve ter no minimo 8 caracteres')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas nao coincidem')
      return
    }

    setLoading(true)
    try {
      // Update password in Supabase Auth
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (authError) throw authError

      // Clear the must_change_password flag
      if (user?.id) {
        await supabase
          .from('users')
          .update({ must_change_password: false })
          .eq('id', user.id)
      }

      navigate('/')
    } catch (err) {
      console.error('Error changing password:', err)
      setError('Erro ao alterar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-600 to-teal-500 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Alterar Senha</h1>
          <p className="text-gray-600 mt-2">
            Por seguranca, voce precisa criar uma nova senha para acessar o sistema.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="newPassword" className="text-gray-700">Nova Senha</Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="pl-10 bg-white border-gray-300"
                placeholder="Minimo 8 caracteres"
              />
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2" />
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-gray-700">Confirmar Nova Senha</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="pl-10 bg-white border-gray-300"
                placeholder="Repita a nova senha"
              />
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-2" />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white shadow-lg"
            disabled={loading}
          >
            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
          </Button>
        </form>
      </div>
    </div>
  )
}
