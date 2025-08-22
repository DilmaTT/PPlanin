export default function DashboardPage() {
  console.log('DashboardPage rendered - minimal version'); // Лог для подтверждения рендеринга компонента
  console.log('TEST DIV is being rendered in minimal DashboardPage'); // Перемещено за пределы JSX

  return (
    <div style={{
      padding: '50px',
      margin: '50px',
      backgroundColor: 'red',
      color: 'white',
      fontSize: '3em',
      fontWeight: 'bold',
      textAlign: 'center',
      border: '10px solid blue',
      width: 'fit-content',
      height: 'fit-content'
    }}>
      ТЕСТОВЫЙ DIV
    </div>
  );
}
