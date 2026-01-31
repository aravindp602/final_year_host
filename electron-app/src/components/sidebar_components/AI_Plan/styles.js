// AIPlanOverlay.styles.js

export const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(2,6,23,0.98))',
    backdropFilter: 'blur(18px)',
    zIndex: 10000,
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    fontFamily: "'Inter', system-ui, sans-serif"
  },

  modal: {
    width: '96%', maxWidth: '1500px', height: '92%',
    background: 'linear-gradient(180deg,#ffffff,#f8fafc)',
    borderRadius: '28px',
    boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.4)'
  },

  header: {
    padding: '26px 36px',
    background: 'linear-gradient(90deg,#020617,#0f172a)',
    color: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },

  headerTitle: { fontSize: '22px', fontWeight: '800', letterSpacing: '0.5px' },
  headerSub: { fontSize: '12px', color: '#c7d2fe', marginTop: '6px' },

  tabBar: {
    display: 'flex', padding: '0 36px',
    background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
    gap: '32px'
  },

  tab: (active) => ({
    padding: '16px 2px',
    fontSize: '14px', fontWeight: '700',
    color: active ? '#2563eb' : '#64748b',
    borderBottom: active ? '3px solid #2563eb' : '3px solid transparent',
    cursor: 'pointer',
    transition: '0.25s'
  }),

  content: {
    flex: 1, display: 'flex',
    background: 'linear-gradient(180deg,#f1f5f9,#f8fafc)',
    padding: '36px',
    overflow: 'hidden'
  },

  paper: {
    background: '#ffffff',
    borderRadius: '18px',
    padding: '0 44px 0 44px',
    maxWidth: '950px',
    margin: '0 auto',
    overflowY: 'auto',
    height: '100%',
    boxShadow: '0 20px 40px rgba(15,23,42,0.08)',
    border: '1px solid #e5e7eb',
    fontSize: '15px',
    lineHeight: '1.85',
    color: '#1e293b'
  },

  cardContainer: {
    width: '100%', maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex', flexDirection: 'column',
    gap: '18px',
    overflowY: 'auto'
  },

  card: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '26px',
    display: 'flex',
    gap: '28px',
    border: '1px solid #e5e7eb',
    boxShadow: '0 10px 30px rgba(0,0,0,0.04)'
  },

  colSection: { width: '240px' },
  colName: { fontSize: '17px', fontWeight: '800', color: '#020617' },
  colSub: { fontSize: '12px', color: '#64748b', marginTop: '4px' },

  pipelineSection: { flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' },

  pipelineVisual: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },

  stepBadge: (color) => ({
    background: '#fff',
    color,
    border: `1px solid ${color}40`,
    padding: '7px 14px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
  }),

  arrow: { color: '#94a3b8', fontSize: '16px', fontWeight: '800' },

  reasonBox: {
    background: 'linear-gradient(180deg,#f8fafc,#f1f5f9)',
    padding: '14px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    fontSize: '13px',
    color: '#334155',
    fontStyle: 'italic'
  },

  btnPrimary: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 10px 25px rgba(37,99,235,0.35)'
  },

  btnGhost: {
    padding: '12px 22px',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    fontWeight: '600',
    cursor: 'pointer'
  },

  addBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
    background: '#f8fafc',
    fontSize: '12px',
    cursor: 'pointer'
  }
};