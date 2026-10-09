#include <vtkProperty.h>
#include <vtkSelectPolyData.h>
#include <vtkSphereSource.h>
#include <vtkClipPolyData.h>
#include <vtkProperty.h>
#include <vtkPolyDataMapper.h>
#include <vtkLODActor.h>
#include <vtkRenderWindowInteractor.h>
#include <vtkRenderWindow.h>
#include <vtkRenderer.h>
#include <vtkNamedColors.h>

int main() {
    vtkNew<vtkNamedColors> colors;
    vtkNew<vtkSphereSource> sphereSource;
    sphereSource->SetPhiResolution(50);
    sphereSource->SetThetaResolution(100);
    sphereSource->Update();

    vtkNew<vtkPoints> loopPoints;
    loopPoints->InsertNextPoint(-0.16553, 0.135971, 0.451972);
    loopPoints->InsertNextPoint(-0.0880123, -0.134952, 0.4747);
    loopPoints->InsertNextPoint(0.00292618, -0.134604, 0.482459);
    loopPoints->InsertNextPoint(0.0641941, 0.067112, 0.490947);
    loopPoints->InsertNextPoint(0.15577, 0.0734765, 0.469245);
    loopPoints->InsertNextPoint(0.166667, -0.129217, 0.454622);
    loopPoints->InsertNextPoint(0.241259, -0.123363, 0.420581);
    loopPoints->InsertNextPoint(0.240334, 0.0727106, 0.432555);
    loopPoints->InsertNextPoint(0.308529, 0.0844311, 0.384357);
    loopPoints->InsertNextPoint(0.32672, -0.121674, 0.359187);
    loopPoints->InsertNextPoint(0.380721, -0.117342, 0.302527);
    loopPoints->InsertNextPoint(0.387804, 0.0455074, 0.312375);
    loopPoints->InsertNextPoint(0.43943, -0.111673, 0.211707);
    loopPoints->InsertNextPoint(0.470984, -0.0801913, 0.147919);
    loopPoints->InsertNextPoint(0.436777, 0.0688872, 0.233021);
    loopPoints->InsertNextPoint(0.44874, 0.188852, 0.109882);
    loopPoints->InsertNextPoint(0.391352, 0.254285, 0.176943);
    loopPoints->InsertNextPoint(0.373274, 0.154162, 0.294296);
    loopPoints->InsertNextPoint(0.274659, 0.311654, 0.276609);
    loopPoints->InsertNextPoint(0.206068, 0.31396, 0.329702);
    loopPoints->InsertNextPoint(0.263789, 0.174982, 0.387308);
    loopPoints->InsertNextPoint(0.213034, 0.175485, 0.417142);
    loopPoints->InsertNextPoint(0.169113, 0.261974, 0.390286);
    loopPoints->InsertNextPoint(0.102552, 0.25997, 0.414814);
    loopPoints->InsertNextPoint(0.131512, 0.161254, 0.454705);
    loopPoints->InsertNextPoint(0.000192443, 0.156264, 0.475307);
    loopPoints->InsertNextPoint(-0.0392091, 0.000251724, 0.499943);
    loopPoints->InsertNextPoint(-0.096161, 0.159646, 0.46438);

    vtkNew<vtkSelectPolyData> selectPolyData;
    selectPolyData->SetInputConnection(sphereSource->GetOutputPort());
    selectPolyData->SetLoop(loopPoints);
    selectPolyData->GenerateUnselectedOutputOn();
    selectPolyData->SetSelectionModeToSmallestRegion();
    selectPolyData->Update();

    vtkNew<vtkProperty> backProp;
    backProp->SetColor(colors->GetColor3d("tomato").GetData());

    vtkNew<vtkPolyDataMapper> selectMapper;
    selectMapper->SetInputData(selectPolyData->GetUnselectedOutput());

    vtkNew<vtkLODActor> selectActor;
    selectActor->SetMapper(selectMapper);
    selectActor->SetBackfaceProperty(backProp);
    selectActor->GetProperty()->SetColor(colors->GetColor3d("banana").GetData());

    vtkNew<vtkPolyDataMapper> unselectMapper;
    unselectMapper->SetInputConnection(selectPolyData->GetOutputPort());

    vtkNew<vtkLODActor> unselectActor;
    unselectActor->SetMapper(unselectMapper);
    unselectActor->SetBackfaceProperty(backProp);
    unselectActor->GetProperty()->SetColor(colors->GetColor3d("banana").GetData());

    vtkNew<vtkRenderer> renderer1;
    vtkNew<vtkRenderer> renderer2;

    vtkNew<vtkRenderWindow> renderWindow;
    renderWindow->AddRenderer(renderer1);
    renderWindow->AddRenderer(renderer2);

    vtkNew<vtkRenderWindowInteractor> interactor;
    interactor->SetRenderWindow(renderWindow);

    renderer1->AddActor(selectActor);
    renderer1->SetBackground(colors->GetColor3d("slate_grey").GetData());
    renderer1->SetViewport(0, 0, 0.5, 1);

    renderer2->AddActor(unselectActor);
    renderer2->SetBackground(colors->GetColor3d("slate_blue").GetData());
    renderer2->SetViewport(0.5, 0, 1, 1);

    renderWindow->SetSize(800, 400);
    renderWindow->Render();
    interactor->Start();
    return 0;
    }