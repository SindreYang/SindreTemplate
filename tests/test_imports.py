def test_template_modules_import():
    from src.models.my_net import MyNet
    from src.datamodules.my_datamodule import MyDataset
    from src.pipeline.my_pipeline import MyPipeline

    assert MyNet is not None
    assert MyDataset is not None
    assert MyPipeline is not None
